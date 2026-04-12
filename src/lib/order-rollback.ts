/**
 * 订单回滚工具函数
 * 用于修改订单时，在事务中回滚原订单的库存和成本
 */

import { createStockMovement } from "@/lib/stock"
import { calculateReturnCost } from "@/lib/cost-calculation"

// Prisma 事务客户端类型
type TxClient = Parameters<Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]>[0]

interface RollbackSaleItem {
  productId: string
  quantity: number
  costPrice: number
}

interface RollbackPurchaseItem {
  productId: string
  quantity: number
  unitPrice: number
}

/**
 * 回滚销售单的库存和成本
 *
 * 逻辑：
 * 1. 回滚库存（Product.stock 增加）
 * 2. 回滚库存金额（Product.stockValue 增加，使用 calculateReturnCost）
 * 3. 创建 cancel_sale 类型的 StockMovement
 */
export async function rollbackSaleItems(
  tx: TxClient,
  items: RollbackSaleItem[],
  tenantId: string,
  orderId: string,
  orderNo: string,
  warehouseId: string | null,
  operatorId: string,
  operatorName: string,
): Promise<void> {
  for (const item of items) {
    // 1. 读取当前商品信息（验证存在性）
    const product = await tx.product.findFirst({
      where: { id: item.productId, tenantId },
      select: { id: true },
    })
    if (!product) throw new Error(`回滚失败：商品 ${item.productId} 不存在`)

    // 2. 计算库存金额恢复量（使用销售时的成本价）
    const { costRefund } = calculateReturnCost(item.costPrice, item.quantity)

    // 3. 回滚库存数量和金额（通过库存流水原子更新）
    await createStockMovement(tx, {
      tenantId,
      productId: item.productId,
      type: "cancel_sale",
      quantity: item.quantity,
      warehouseId: warehouseId || undefined,
      refType: "sale_order",
      refId: orderId,
      refNo: orderNo,
      notes: "修改销售单-回滚原单",
      operatorId,
      operatorName,
      costPrice: item.costPrice,
      stockValueDelta: costRefund,
    })
  }
}

/**
 * 回滚进货单的库存和成本
 *
 * 逻辑：
 * 1. 回滚库存（Product.stock 减少）
 * 2. 反向计算加权平均成本（恢复原来的成本价和库存金额）
 * 3. 创建 cancel_purchase 类型的 StockMovement
 * 4. 回滚批次追踪（如有）
 */
export async function rollbackPurchaseItems(
  tx: TxClient,
  items: RollbackPurchaseItem[],
  tenantId: string,
  orderId: string,
  orderNo: string,
  warehouseId: string | null,
  operatorId: string,
  operatorName: string,
): Promise<void> {
  for (const item of items) {
    // 1. 读取当前商品信息
    const product = await tx.product.findFirst({
      where: { id: item.productId, tenantId },
      select: { costPrice: true, stockValue: true, stock: true },
    })
    if (!product) throw new Error(`回滚失败：商品 ${item.productId} 不存在`)

    const currentStock = product.stock
    const currentCostPrice = Number(product.costPrice)
    const currentStockValue = Number(product.stockValue)

    // 2. 回滚库存金额：减去这次进货增加的金额
    const incomingAmount = item.quantity * item.unitPrice
    const newStockValue = currentStockValue - incomingAmount
    const newStock = currentStock - item.quantity

    // 3. 反算成本价：回滚后的库存金额 / 回滚后的库存量
    //    如果库存归零，成本价保持不变
    let newCostPrice = currentCostPrice
    if (newStock > 0 && newStockValue > 0) {
      newCostPrice = newStockValue / newStock
    } else if (newStock <= 0) {
      // 库存归零，成本价也归零
      newCostPrice = 0
    }

    // 4. 更新商品成本价（库存金额由 createStockMovement 原子更新）
    await tx.product.update({
      where: { id: item.productId },
      data: {
        costPrice: newCostPrice,
      },
    })

    // 5. 回滚库存数量和金额（通过库存流水原子更新）
    const stockValueDelta = -incomingAmount
    await createStockMovement(tx, {
      tenantId,
      productId: item.productId,
      type: "cancel_purchase",
      quantity: -item.quantity,
      warehouseId: warehouseId || undefined,
      refType: "purchase_order",
      refId: orderId,
      refNo: orderNo,
      notes: "修改进货单-回滚原单",
      operatorId,
      operatorName,
      costPrice: newCostPrice,
      stockValueDelta,
    })

    // 6. 回滚批次追踪：删除本次进货创建的批次
    await tx.batch.deleteMany({
      where: {
        purchaseOrderId: orderId,
        productId: item.productId,
        tenantId,
      },
    })
  }
}
