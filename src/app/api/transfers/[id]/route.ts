import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.transferOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })
    if (!order) return apiError("调拨单不存在", 404)

    // Enrich with names
    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: order.fromWarehouseId, tenantId: auth.tenantId }, select: { name: true } }),
      prisma.warehouse.findFirst({ where: { id: order.toWarehouseId, tenantId: auth.tenantId }, select: { name: true } }),
    ])

    const productIds = order.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { tenantId: auth.tenantId, id: { in: productIds } },
      select: { id: true, name: true, unit: true },
    })
    const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))

    return apiSuccess({
      ...order,
      fromWarehouseName: fromWh?.name || "未知",
      toWarehouseName: toWh?.name || "未知",
      items: order.items.map((i) => ({ ...i, product: prodMap[i.productId] || null })),
    })
  } catch (error) {
    console.error("获取调拨单失败:", error)
    return apiError("获取调拨单失败", 500)
  }
}

// 调拨完成：将调拨单状态改为 completed，执行仓库库存调拨
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.transferOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })
    if (!order) return apiError("调拨单不存在", 404)
    if (order.status === "completed") return apiError("调拨单已完成，不能重复操作")
    if (order.status === "cancelled") return apiError("已取消的调拨单不能完成")
    if (order.status !== "pending") return apiError("只能完成待处理的调拨单")

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        // 源仓库调出：仅扣减调出仓库库存，不改变 Product.stock
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "transfer_out",
          quantity: -item.quantity,
          warehouseId: order.fromWarehouseId,
          refType: "transfer_order",
          refId: order.id,
          refNo: order.transferNo,
          notes: `调拨出库 (${order.transferNo})`,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
          skipProductStockUpdate: true,
        })

        // 目标仓库调入：仅增加调入仓库库存，不改变 Product.stock
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "transfer_in",
          quantity: item.quantity,
          warehouseId: order.toWarehouseId,
          refType: "transfer_order",
          refId: order.id,
          refNo: order.transferNo,
          notes: `调拨入库 (${order.transferNo})`,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
          skipProductStockUpdate: true,
        })
      }

      await tx.transferOrder.update({
        where: { id },
        data: { status: "completed" },
      })
    })

    await logAudit(auth, "update", "warehouse", id,
      `完成调拨 ${order.transferNo}`)

    return apiSuccess({ message: "调拨已完成，库存已调整" })
  } catch (error) {
    console.error("调拨完成失败:", error)
    if (error instanceof Error && error.message) {
      if (error.message.includes("库存不足") || error.message.includes("无权限")) {
        return apiError(error.message)
      }
    }
    return apiError("调拨完成失败", 500)
  }
}
