import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.saleOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        customer: true,
        user: true,
        items: { include: { product: true } },
      },
    })

    if (!order) return apiError("销售单不存在", 404)
    return apiSuccess(order)
  } catch (error) {
    console.error("获取销售单失败:", error)
    return apiError("获取销售单失败", 500)
  }
}

// 取消销售单 — 仅 owner
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()

    if (body.action !== "cancel") {
      return apiError("不支持的操作")
    }

    const order = await prisma.saleOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })

    if (!order) return apiError("销售单不存在", 404)
    if (order.status === "cancelled") return apiError("该订单已取消")
    if (order.status !== "completed") return apiError("只能取消已完成的订单")

    const returnCount = await prisma.returnOrder.count({
      where: { saleOrderId: id, tenantId: auth.tenantId },
    })
    if (returnCount > 0) return apiError("该销售单已有退货记录，不能取消")

    // 事务：取消订单 + 回滚库存 + 回滚客户余额
    await prisma.$transaction(async (tx) => {
      const txReturnCount = await tx.returnOrder.count({
        where: { saleOrderId: id, tenantId: auth.tenantId },
      })
      if (txReturnCount > 0) {
        throw new Error("该销售单已有退货记录，不能取消")
      }

      // 1. 标记订单为已取消
      await tx.saleOrder.update({
        where: { id },
        data: { status: "cancelled" },
      })

      // 2. 回滚库存（通过库存流水）
      for (const item of order.items) {
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "cancel_sale",
          quantity: item.quantity,
          warehouseId: order.warehouseId || undefined,
          refType: "sale_order",
          refId: order.id,
          refNo: order.orderNo,
          notes: "取消销售单",
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
        })
      }

      // 3. 回滚客户余额：欠款部分 = totalAmount - paidAmount
      if (order.customerId) {
        const unpaid = Number(order.totalAmount) - Number(order.paidAmount)
        if (unpaid > 0) {
          const updated = await tx.customer.updateMany({
            where: {
              id: order.customerId,
              tenantId: auth.tenantId,
              balance: { gte: unpaid },
            },
            data: { balance: { decrement: unpaid } },
          })
          if (updated.count !== 1) {
            throw new Error("客户欠款已变更，请重试取消")
          }
        }
      }
    })

    await logAudit(auth, "cancel", "sale", id, `取消销售单 ${order.orderNo}`)

    return apiSuccess({ message: "订单已取消" })
  } catch (error) {
    console.error("取消销售单失败:", error)
    if (error instanceof Error && error.message) {
      return apiError(error.message)
    }
    return apiError("取消销售单失败", 500)
  }
}
