import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"
import { calculateWeightedAverageCost } from "@/lib/cost-calculation"
import { rollbackPurchaseItems } from "@/lib/order-rollback"
import { purchaseOrderSchema } from "@/lib/validations"
import { validateBody } from "@/lib/validate"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()

    // ===== 取消进货单 =====
    if (body.action === "cancel") {
      return await cancelPurchaseOrder(id, auth)
    }

    // ===== 修改进货单 =====
    if (body.action === "update") {
      return await updatePurchaseOrder(id, auth, body)
    }

    return apiError("不支持的操作")
  } catch (error) {
    console.error("操作进货单失败:", error)
    if (error instanceof Error && error.message) {
      return apiError(error.message)
    }
    return apiError("操作进货单失败", 500)
  }
}

/**
 * 取消进货单
 */
async function cancelPurchaseOrder(
  id: string,
  auth: { tenantId: string; userId: string; userName: string; role: string },
) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { items: { include: { product: true } } },
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

    // 2. 回滚库存（通过库存流水）
    for (const item of order.items) {
      await createStockMovement(tx, {
        tenantId: auth.tenantId,
        productId: item.productId,
        type: "cancel_purchase",
        quantity: -item.quantity,
        warehouseId: order.warehouseId || undefined,
        refType: "purchase_order",
        refId: order.id,
        refNo: order.orderNo,
        notes: "取消采购单",
        operatorId: auth.userId,
        operatorName: auth.userName || "未知用户",
      })
    }

    // 3. 回滚供应商余额：欠款部分 = totalAmount - paidAmount
    const unpaid = Number(order.totalAmount) - Number(order.paidAmount)
    if (unpaid > 0) {
      const updated = await tx.supplier.updateMany({
        where: {
          id: order.supplierId,
          tenantId: auth.tenantId,
          balance: { gte: unpaid },
        },
        data: { balance: { decrement: unpaid } },
      })
      if (updated.count !== 1) {
        throw new Error("供应商欠款已变更，请重试取消")
      }
    }
  })

  await logAudit(auth, "cancel", "purchase", id, `取消进货单 ${order.orderNo}`)

  return apiSuccess({ message: "订单已取消" })
}

/**
 * 修改进货单
 * 逻辑：回滚旧单 + 重建新单（同一事务内）
 */
async function updatePurchaseOrder(
  id: string,
  auth: { tenantId: string; userId: string; userName: string; role: string },
  body: Record<string, unknown>,
) {
  // 1. 校验请求体
  const validation = validateBody(purchaseOrderSchema, body)
  if (!validation.success) {
    return apiError(validation.error, 400)
  }
  const { supplierId, items, paidAmount, notes, warehouseId } = validation.data

  // 2. 读取原订单
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { items: true },
  })

  if (!order) return apiError("进货单不存在", 404)
  if (order.status === "cancelled") return apiError("已取消的订单不能修改")
  if (order.status !== "completed") return apiError("只能修改已完成的订单")

  // 3. 验证供应商归属
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: auth.tenantId },
  })
  if (!supplier) return apiError("供应商不存在")

  // 4. 计算新单总金额
  let newTotalAmount = 0
  const orderItems: Array<{
    productId: string
    quantity: number
    unitPrice: number
    subtotal: number
  }> = []

  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return apiError("商品信息不完整")
    }
    const subtotal = (item.quantity ?? 0) * (item.unitPrice ?? 0)
    newTotalAmount += subtotal
    orderItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      subtotal,
    })
  }

  const newPaid = paidAmount ?? 0
  const newUnpaid = newTotalAmount - newPaid

  // 5. 事务：回滚旧单 + 重建新单
  const result = await prisma.$transaction(async (tx) => {
    // ---- 阶段A：回滚旧单 ----

    // A1. 回滚原订单的供应商余额
    const oldUnpaid = Number(order.totalAmount) - Number(order.paidAmount)
    if (oldUnpaid > 0) {
      const updated = await tx.supplier.updateMany({
        where: {
          id: order.supplierId,
          tenantId: auth.tenantId,
          balance: { gte: oldUnpaid },
        },
        data: { balance: { decrement: oldUnpaid } },
      })
      if (updated.count !== 1) {
        throw new Error("供应商欠款已变更，请重试修改")
      }
    }

    // A2. 回滚原订单的库存和成本
    await rollbackPurchaseItems(
      tx,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
      auth.tenantId,
      order.id,
      order.orderNo,
      order.warehouseId,
      auth.userId,
      auth.userName || "未知用户",
    )

    // A3. 删除原订单项
    await tx.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: id },
    })

    // ---- 阶段B：重建新单 ----

    // B1. 更新订单字段 + 创建新订单项
    const updatedOrder = await tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierId,
        warehouseId: warehouseId || null,
        totalAmount: newTotalAmount,
        paidAmount: newPaid,
        notes: notes?.trim() || null,
        items: {
          create: orderItems,
        },
      },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    })

    // B2. 增加库存 + 成本核算
    for (const item of orderItems) {
      // 事务内读取最新商品数据
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId: auth.tenantId },
        select: {
          id: true,
          stock: true,
          costPrice: true,
          stockValue: true,
          enableBatchTracking: true,
        },
      })
      if (!product) throw new Error("商品不存在")

      // 计算加权平均成本
      const costResult = calculateWeightedAverageCost({
        currentStock: product.stock,
        currentCostPrice: Number(product.costPrice),
        currentStockValue: Number(product.stockValue),
        incomingQty: item.quantity,
        incomingPrice: item.unitPrice,
      })

      // 更新商品成本价、库存金额、最近进价
      await tx.product.update({
        where: { id: item.productId },
        data: {
          costPrice: costResult.newCostPrice,
          stockValue: costResult.newStockValue,
          lastCostPrice: item.unitPrice,
        },
      })

      // 创建库存流水
      await createStockMovement(tx, {
        tenantId: auth.tenantId,
        productId: item.productId,
        type: "purchase_in",
        quantity: item.quantity,
        warehouseId: warehouseId || undefined,
        refType: "purchase_order",
        refId: updatedOrder.id,
        refNo: updatedOrder.orderNo,
        operatorId: auth.userId,
        operatorName: auth.userName || "未知用户",
        costPrice: costResult.newCostPrice,
        stockValueAfter: costResult.newStockValue,
      })

      // 批次追踪：创建批次记录
      if (product.enableBatchTracking) {
        await tx.batch.create({
          data: {
            tenantId: auth.tenantId,
            productId: item.productId,
            batchNo: updatedOrder.orderNo,
            quantity: item.quantity,
            costPrice: item.unitPrice,
            remainingQty: item.quantity,
            purchaseOrderId: updatedOrder.id,
          },
        })
      }
    }

    // B3. 更新供应商应付余额
    if (newUnpaid > 0) {
      await tx.supplier.update({
        where: { id: supplierId },
        data: { balance: { increment: newUnpaid } },
      })
    }

    return updatedOrder
  })

  await logAudit(auth, "update", "purchase", id, `修改进货单 ${order.orderNo}，金额 ¥${newTotalAmount.toFixed(2)}`)

  return apiSuccess(result)
}
