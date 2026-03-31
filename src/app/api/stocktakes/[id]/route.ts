import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取盘点单详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.stocktakeOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })
    if (!order) return apiError("盘点单不存在", 404)

    // Enrich with product info
    const productIds = order.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, unit: true, stock: true },
    })
    const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))

    // Warehouse name
    let warehouseName = null
    if (order.warehouseId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: order.warehouseId }, select: { name: true } })
      warehouseName = wh?.name
    }

    return apiSuccess({
      ...order,
      warehouseName,
      items: order.items.map((i) => ({ ...i, product: prodMap[i.productId] || null })),
    })
  } catch (error) {
    console.error("获取盘点单失败:", error)
    return apiError("获取盘点单失败", 500)
  }
}

// 更新盘点单: start(开始盘点) | count(录入数量) | complete(确认完成,自动调账) | cancel(取消)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()
    const { action } = body

    const order = await prisma.stocktakeOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })
    if (!order) return apiError("盘点单不存在", 404)

    // 开始盘点
    if (action === "start") {
      if (order.status !== "draft") return apiError("只能开始草稿状态的盘点单")
      await prisma.stocktakeOrder.update({
        where: { id },
        data: { status: "in_progress" },
      })
      return apiSuccess({ message: "盘点已开始" })
    }

    // 录入实际数量
    if (action === "count") {
      if (order.status !== "in_progress") return apiError("只能在盘点中录入数量")
      const { counts } = body // [{ itemId, actualQty }]
      if (!counts?.length) return apiError("请提供盘点数量")

      for (const c of counts) {
        const item = order.items.find((i) => i.id === c.itemId)
        if (!item) continue
        const actualQty = parseInt(c.actualQty)
        if (isNaN(actualQty) || actualQty < 0) continue
        await prisma.stocktakeItem.update({
          where: { id: c.itemId },
          data: {
            actualQty,
            diffQty: actualQty - item.systemQty,
          },
        })
      }
      return apiSuccess({ message: "数量已保存" })
    }

    // 确认完成 — 仅 owner，自动生成 adjustment 流水
    if (action === "complete") {
      const ownerAuth = requireOwner(request)
      if (isAuthError(ownerAuth)) return ownerAuth

      if (order.status !== "in_progress") return apiError("只能确认进行中的盘点单")

      // 检查所有项是否都已录入
      const uncounted = order.items.filter((i) => i.actualQty === null)
      if (uncounted.length > 0) return apiError(`还有 ${uncounted.length} 个商品未录入实际数量`)

      // 找出有差异的项
      const diffItems = order.items.filter((i) => i.diffQty !== null && i.diffQty !== 0)

      await prisma.$transaction(async (tx) => {
        // 为每个有差异的商品创建 adjustment 流水
        for (const item of diffItems) {
          await createStockMovement(tx, {
            tenantId: auth.tenantId,
            productId: item.productId,
            type: "adjustment",
            quantity: item.diffQty!,
            warehouseId: order.warehouseId || undefined,
            refType: "manual",
            refNo: order.stocktakeNo,
            notes: `盘点调整 (${order.stocktakeNo})`,
            operatorId: auth.userId,
            operatorName: auth.userName || "未知用户",
          })
        }

        await tx.stocktakeOrder.update({
          where: { id },
          data: { status: "completed", completedAt: new Date() },
        })
      })

      await logAudit(auth, "update", "warehouse", id,
        `完成盘点 ${order.stocktakeNo}，${diffItems.length} 项有差异`)

      return apiSuccess({ message: "盘点已完成，库存已调整" })
    }

    // 取消盘点
    if (action === "cancel") {
      if (order.status === "completed") return apiError("已完成的盘点不能取消")
      await prisma.stocktakeOrder.update({
        where: { id },
        data: { status: "cancelled" },
      })
      return apiSuccess({ message: "盘点已取消" })
    }

    return apiError("不支持的操作")
  } catch (error) {
    console.error("更新盘点单失败:", error)
    return apiError("更新盘点单失败", 500)
  }
}
