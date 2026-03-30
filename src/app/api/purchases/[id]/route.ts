import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    })

    if (!order) return apiError("进货单不存在", 404)
    return apiSuccess(order)
  } catch (error) {
    console.error("获取进货单失败:", error)
    return apiError("获取进货单失败", 500)
  }
}

// 取消进货单 — 仅 owner
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()

    if (body.action !== "cancel") {
      return apiError("不支持的操作")
    }

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })

    if (!order) return apiError("进货单不存在", 404)
    if (order.status === "cancelled") return apiError("该订单已取消")
    if (order.status !== "completed") return apiError("只能取消已完成的订单")

    // 事务：取消订单 + 回滚库存 + 回滚供应商余额
    await prisma.$transaction(async (tx) => {
      // 1. 标记订单为已取消
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "cancelled" },
      })

      // 2. 回滚库存：每个商品 stock -= quantity
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }

      // 3. 回滚供应商余额：欠款部分 = totalAmount - paidAmount
      const unpaid = Number(order.totalAmount) - Number(order.paidAmount)
      if (unpaid > 0) {
        await tx.supplier.update({
          where: { id: order.supplierId },
          data: { balance: { decrement: unpaid } },
        })
      }
    })

    return apiSuccess({ message: "订单已取消" })
  } catch (error) {
    console.error("取消进货单失败:", error)
    return apiError("取消进货单失败", 500)
  }
}
