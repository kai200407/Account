import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"
import { calculateAdjustmentCost } from "@/lib/cost-calculation"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取盘点单详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
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
      where: { tenantId: auth.tenantId, id: { in: productIds } },
      select: { id: true, name: true, unit: true, stock: true },
    })
    const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))

    // Warehouse name
    let warehouseName = null
    if (order.warehouseId) {
      const wh = await prisma.warehouse.findFirst({
        where: { id: order.warehouseId, tenantId: auth.tenantId },
        select: { name: true },
      })
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

// 盘点完成：将盘点单状态改为 completed，差异项自动调账
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.stocktakeOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })
    if (!order) return apiError("盘点单不存在", 404)
    if (order.status !== "in_progress") return apiError("只能完成进行中的盘点单")

    // 检查所有项是否都已录入
    const uncounted = order.items.filter((i) => i.actualQty === null)
    if (uncounted.length > 0) return apiError(`还有 ${uncounted.length} 个商品未录入实际数量`)

    // 找出有差异的项（diffQty = actualQty - systemQty）
    const diffItems = order.items.filter((i) => i.diffQty !== null && i.diffQty !== 0)

    await prisma.$transaction(async (tx) => {
      // 为每个有差异的商品：计算成本变动 → 创建 StockMovement（stockValue 原子更新）
      for (const item of diffItems) {
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { costPrice: true },
        })
        if (!currentProduct) throw new Error(`商品 ${item.productId} 不存在`)

        const costPrice = Number(currentProduct.costPrice ?? 0)
        const { stockValueChange } = calculateAdjustmentCost(costPrice, item.diffQty!)

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
          costPrice,
          stockValueDelta: stockValueChange,
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
  } catch (error) {
    console.error("盘点完成失败:", error)
    if (error instanceof Error && (error.message.includes("库存不足") || error.message.includes("无权限"))) {
      return apiError(error.message)
    }
    return apiError("盘点完成失败", 500)
  }
}

// 更新盘点单: start(开始盘点) | count(录入数量) | complete(确认完成,自动调账) | cancel(取消)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
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
      const counts = Array.isArray(body.counts) ? body.counts : [] // [{ itemId, actualQty }]
      if (counts.length === 0) return apiError("请提供盘点数量")

      const itemMap = new Map(order.items.map((item) => [item.id, item]))
      const seen = new Set<string>()
      const updates: Array<{ id: string; actualQty: number; diffQty: number }> = []

      for (const c of counts as Array<{ itemId?: string; actualQty?: number | string }>) {
        if (!c?.itemId || typeof c.itemId !== "string") {
          return apiError("存在无效的盘点项")
        }
        if (seen.has(c.itemId)) {
          return apiError("存在重复的盘点项")
        }
        seen.add(c.itemId)

        const item = itemMap.get(c.itemId)
        if (!item) {
          return apiError("盘点项不存在或不属于当前盘点单")
        }

        const actualQty = Number.parseInt(String(c.actualQty), 10)
        if (!Number.isInteger(actualQty) || actualQty < 0) {
          return apiError(`商品「${item.productId}」盘点数量无效`)
        }

        updates.push({
          id: c.itemId,
          actualQty,
          diffQty: actualQty - item.systemQty,
        })
      }

      await prisma.$transaction(
        updates.map((u) =>
          prisma.stocktakeItem.update({
            where: { id: u.id },
            data: { actualQty: u.actualQty, diffQty: u.diffQty },
          })
        )
      )
      return apiSuccess({ message: "数量已保存" })
    }

    // 确认完成 — 仅 owner，自动生成 adjustment 流水
    if (action === "complete") {
      const ownerAuth = await requireOwner(request)
      if (isAuthError(ownerAuth)) return ownerAuth

      if (order.status !== "in_progress") return apiError("只能确认进行中的盘点单")

      // 检查所有项是否都已录入
      const uncounted = order.items.filter((i) => i.actualQty === null)
      if (uncounted.length > 0) return apiError(`还有 ${uncounted.length} 个商品未录入实际数量`)

      // 找出有差异的项
      const diffItems = order.items.filter((i) => i.diffQty !== null && i.diffQty !== 0)

      await prisma.$transaction(async (tx) => {
        // 为每个有差异的商品：计算成本变动 → 创建 adjustment 流水（stockValue 原子更新）
        for (const item of diffItems) {
          const currentProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: { costPrice: true },
          })
          if (!currentProduct) throw new Error(`商品 ${item.productId} 不存在`)

          const costPrice = Number(currentProduct.costPrice ?? 0)
          const { stockValueChange } = calculateAdjustmentCost(costPrice, item.diffQty!)

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
            costPrice,
            stockValueDelta: stockValueChange,
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
