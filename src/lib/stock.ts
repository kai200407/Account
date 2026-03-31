/**
 * 库存流水核心库
 * 所有库存变动必须通过此模块，保证 Product.stock 与流水 balanceAfter 一致
 */

// Prisma 事务客户端类型
type TxClient = Parameters<Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]>[0]

export type StockMovementType =
  | "purchase_in"      // 采购入库
  | "sale_out"         // 销售出库
  | "return_in"        // 退货入库
  | "cancel_purchase"  // 取消采购（回滚出库）
  | "cancel_sale"      // 取消销售（回滚入库）
  | "adjustment"       // 手动调整
  | "transfer_in"      // 调拨入库
  | "transfer_out"     // 调拨出库

export type StockRefType =
  | "purchase_order"
  | "sale_order"
  | "return_order"
  | "transfer_order"
  | "manual"

export interface CreateStockMovementParams {
  tenantId: string
  productId: string
  type: StockMovementType
  /** 正数=入库, 负数=出库 */
  quantity: number
  warehouseId?: string
  refType?: StockRefType
  refId?: string
  refNo?: string
  notes?: string
  operatorId: string
  operatorName: string
}

/**
 * 在事务中创建库存流水并同步更新 Product.stock
 *
 * 使用方式:
 *   await prisma.$transaction(async (tx) => {
 *     await createStockMovement(tx, { ... })
 *   })
 *
 * 保证:
 * 1. Product.stock 按 quantity 增减
 * 2. StockMovement.balanceAfter 等于变动后的 Product.stock
 * 3. 二者在同一事务中完成，保持一致性
 */
export async function createStockMovement(
  tx: TxClient,
  params: CreateStockMovementParams
) {
  const {
    tenantId,
    productId,
    type,
    quantity,
    warehouseId,
    refType,
    refId,
    refNo,
    notes,
    operatorId,
    operatorName,
  } = params

  if (quantity === 0) {
    throw new Error("库存变动数量不能为0")
  }

  // 多租户强校验：禁止跨租户修改库存
  const product = await tx.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true },
  })
  if (!product) {
    throw new Error("商品不存在或无权限")
  }

  const updated = await tx.product.updateMany({
    where: {
      id: productId,
      tenantId,
      ...(quantity < 0 ? { stock: { gte: Math.abs(quantity) } } : {}),
    },
    data: {
      stock: { increment: quantity },
    },
  })
  if (updated.count !== 1) {
    if (quantity < 0) {
      throw new Error("库存不足")
    }
    throw new Error("库存更新失败：商品不存在或无权限")
  }

  const updatedProduct = await tx.product.findUnique({
    where: { id: productId },
    select: { stock: true },
  })
  if (!updatedProduct) {
    throw new Error("库存更新失败：商品不存在")
  }

  // 创建流水记录
  const movement = await tx.stockMovement.create({
    data: {
      tenantId,
      productId,
      warehouseId: warehouseId ?? null,
      type,
      quantity,
      balanceAfter: updatedProduct.stock,
      refType: refType ?? null,
      refId: refId ?? null,
      refNo: refNo ?? null,
      notes: notes ?? null,
      operatorId,
      operatorName,
    },
  })

  // 如果指定了仓库，同步更新仓库库存
  if (warehouseId) {
    await updateWarehouseStock(tx, warehouseId, productId, tenantId, quantity)
  }

  return movement
}

/**
 * 批量创建库存流水（用于一个订单包含多个商品的场景）
 */
export async function createStockMovements(
  tx: TxClient,
  items: Array<{ productId: string; quantity: number }>,
  shared: Omit<CreateStockMovementParams, "productId" | "quantity">
) {
  const movements = []
  for (const item of items) {
    const movement = await createStockMovement(tx, {
      ...shared,
      productId: item.productId,
      quantity: item.quantity,
    })
    movements.push(movement)
  }
  return movements
}

/**
 * 更新仓库库存（upsert）
 */
async function updateWarehouseStock(
  tx: TxClient,
  warehouseId: string,
  productId: string,
  tenantId: string,
  delta: number
) {
  const warehouse = await tx.warehouse.findFirst({
    where: { id: warehouseId, tenantId },
    select: { id: true },
  })
  if (!warehouse) {
    throw new Error("仓库不存在或无权限")
  }

  const existing = await tx.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  })

  if (existing) {
    if (existing.tenantId !== tenantId) {
      throw new Error("仓库库存数据租户不匹配")
    }
    if (delta < 0) {
      const updated = await tx.warehouseStock.updateMany({
        where: {
          id: existing.id,
          tenantId,
          quantity: { gte: Math.abs(delta) },
        },
        data: { quantity: { increment: delta } },
      })
      if (updated.count !== 1) {
        throw new Error("仓库库存不足")
      }
    } else {
      await tx.warehouseStock.update({
        where: { id: existing.id },
        data: { quantity: { increment: delta } },
      })
    }
  } else {
    if (delta < 0) {
      throw new Error("仓库库存不足")
    }
    await tx.warehouseStock.create({
      data: {
        tenantId,
        warehouseId,
        productId,
        quantity: delta,
      },
    })
  }
}
