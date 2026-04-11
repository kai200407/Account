import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"
import { calculateSaleCost } from "@/lib/cost-calculation"
import { rollbackSaleItems } from "@/lib/order-rollback"
import { saleOrderSchema } from "@/lib/validations"
import { validateBody } from "@/lib/validate"
import type { JwtPayload } from "@/lib/auth"

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

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()

    // ===== 取消销售单 =====
    if (body.action === "cancel") {
      return await cancelSaleOrder(id, auth)
    }

    // ===== 修改销售单 =====
    if (body.action === "update") {
      return await updateSaleOrder(id, auth, body)
    }

    return apiError("不支持的操作")
  } catch (error) {
    console.error("操作销售单失败:", error)
    if (error instanceof Error && error.message) {
      return apiError(error.message)
    }
    return apiError("操作销售单失败", 500)
  }
}

/**
 * 取消销售单
 */
async function cancelSaleOrder(
  id: string,
  auth: JwtPayload,
) {
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
}

/**
 * 修改销售单
 * 逻辑：回滚旧单 + 重建新单（同一事务内）
 */
async function updateSaleOrder(
  id: string,
  auth: JwtPayload,
  body: Record<string, unknown>,
) {
  // 1. 校验请求体
  const validation = validateBody(saleOrderSchema, body)
  if (!validation.success) {
    return apiError(validation.error, 400)
  }
  const { customerId, saleType, items, paidAmount, notes, warehouseId } = validation.data

  // 2. 读取原订单
  const order = await prisma.saleOrder.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { items: true },
  })

  if (!order) return apiError("销售单不存在", 404)
  if (order.status === "cancelled") return apiError("已取消的订单不能修改")
  if (order.status !== "completed") return apiError("只能修改已完成的订单")

  // 3. 检查退货记录
  const returnCount = await prisma.returnOrder.count({
    where: { saleOrderId: id, tenantId: auth.tenantId },
  })
  if (returnCount > 0) return apiError("该销售单已有退货记录，不能修改")

  // 4. 如果指定了客户，验证归属
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: auth.tenantId },
    })
    if (!customer) return apiError("客户不存在")
  }

  // 5. 计算新单总金额
  let newTotalAmount = 0
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return apiError("商品信息不完整")
    }
    newTotalAmount += item.quantity * (item.unitPrice ?? 0)
  }

  const newPaid = paidAmount ?? 0
  const newUnpaid = newTotalAmount - newPaid
  const newSaleType = saleType || "retail"

  // 6. 事务：回滚旧单 + 重建新单
  const result = await prisma.$transaction(async (tx) => {
    // ---- 阶段A：回滚旧单 ----

    // A1. 回滚原订单的客户余额
    if (order.customerId) {
      const oldUnpaid = Number(order.totalAmount) - Number(order.paidAmount)
      if (oldUnpaid > 0) {
        const updated = await tx.customer.updateMany({
          where: {
            id: order.customerId,
            tenantId: auth.tenantId,
            balance: { gte: oldUnpaid },
          },
          data: { balance: { decrement: oldUnpaid } },
        })
        if (updated.count !== 1) {
          throw new Error("客户欠款已变更，请重试修改")
        }
      }
    }

    // A2. 回滚原订单的库存和成本
    await rollbackSaleItems(
      tx,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        costPrice: Number(item.costPrice),
      })),
      auth.tenantId,
      order.id,
      order.orderNo,
      order.warehouseId,
      auth.userId,
      auth.userName || "未知用户",
    )

    // A3. 删除原订单项
    await tx.saleOrderItem.deleteMany({
      where: { saleOrderId: id },
    })

    // ---- 阶段B：重建新单 ----

    // B1. 事务内读取最新成本，计算利润，构建新订单项
    let totalProfit = 0
    const orderItems: Array<{
      productId: string
      quantity: number
      unitPrice: number
      costPrice: number
      subtotal: number
      profit: number
    }> = []

    for (const item of items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId: auth.tenantId },
        select: { id: true, costPrice: true, stockValue: true, stock: true, name: true, unit: true },
      })
      if (!product) throw new Error("商品不存在")

      // 检查库存是否足够
      if (product.stock < item.quantity) {
        throw new Error(`「${product.name}」库存不足，当前库存 ${product.stock}${product.unit}`)
      }

      const unitPrice = item.unitPrice ?? 0
      const costPrice = Number(product.costPrice)
      const subtotal = item.quantity * unitPrice
      const profit = (unitPrice - costPrice) * item.quantity

      totalProfit += profit

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        costPrice,
        subtotal,
        profit,
      })
    }

    // B2. 更新订单字段 + 创建新订单项
    const updatedOrder = await tx.saleOrder.update({
      where: { id },
      data: {
        customerId: customerId || null,
        warehouseId: warehouseId || null,
        saleType: newSaleType,
        totalAmount: newTotalAmount,
        paidAmount: newPaid,
        profit: totalProfit,
        notes: notes?.trim() || null,
        items: {
          create: orderItems,
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })

    // B3. 扣减库存 + 成本核算
    for (const item of orderItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { costPrice: true, stockValue: true, stock: true },
      })
      if (!product) throw new Error("商品不存在")

      const currentCostPrice = Number(product.costPrice)
      const currentStockValue = Number(product.stockValue)

      // 计算销售成本
      const { stockValueReduction } = calculateSaleCost(currentCostPrice, item.quantity)
      const newStockValue = currentStockValue - stockValueReduction

      // 更新 Product 的库存金额
      await tx.product.update({
        where: { id: item.productId },
        data: { stockValue: newStockValue },
      })

      // 扣减库存（通过库存流水）
      await createStockMovement(tx, {
        tenantId: auth.tenantId,
        productId: item.productId,
        type: "sale_out",
        quantity: -item.quantity,
        warehouseId: warehouseId || undefined,
        refType: "sale_order",
        refId: updatedOrder.id,
        refNo: updatedOrder.orderNo,
        operatorId: auth.userId,
        operatorName: auth.userName || "未知用户",
        costPrice: currentCostPrice,
        stockValueAfter: newStockValue,
      })
    }

    // B4. 更新客户应收余额
    if (newUnpaid > 0 && customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: { balance: { increment: newUnpaid } },
      })
    }

    return updatedOrder
  })

  await logAudit(auth, "update", "sale", id, `修改销售单 ${order.orderNo}，金额 ¥${newTotalAmount.toFixed(2)}`)

  return apiSuccess(result)
}
