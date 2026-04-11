/**
 * 移动加权平均法成本核算
 *
 * 核心公式：新成本 = (原库存金额 + 新进货金额) / (原库存量 + 新进货量)
 */

import Decimal from 'decimal.js'

/** 进货成本计算参数 */
export interface CostUpdateParams {
  /** 当前库存数量 */
  currentStock: number
  /** 当前单位成本 */
  currentCostPrice: number
  /** 当前库存总金额 */
  currentStockValue: number
  /** 新进货数量 */
  incomingQty: number
  /** 新进货单价 */
  incomingPrice: number
}

/** 进货成本计算结果 */
export interface CostUpdateResult {
  /** 新的单位成本 */
  newCostPrice: number
  /** 新的库存总金额 */
  newStockValue: number
  /** 新的库存数量 */
  newStock: number
}

/**
 * 将 Decimal 安全转换为 number，统一保留 2 位小数
 *
 * @param val - Decimal 值
 * @returns 保留 2 位小数的 number
 */
function toSafeNumber(val: Decimal): number {
  return val.toDecimalPlaces(2).toNumber()
}

/**
 * 进货时计算新的加权平均成本
 *
 * 当库存为 0 时，成本直接等于进货单价，避免除零错误。
 *
 * @param params - 进货成本计算参数
 * @returns 新的单位成本、库存总金额和库存数量
 */
export function calculateWeightedAverageCost(
  params: CostUpdateParams,
): CostUpdateResult {
  const {
    currentStock,
    currentCostPrice,
    currentStockValue,
    incomingQty,
    incomingPrice,
  } = params

  const dCurrentStock = new Decimal(currentStock)
  const dCurrentStockValue = new Decimal(currentStockValue)
  const dIncomingQty = new Decimal(incomingQty)
  const dIncomingPrice = new Decimal(incomingPrice)

  const dIncomingAmount = dIncomingQty.mul(dIncomingPrice)
  const dNewStock = dCurrentStock.plus(dIncomingQty)
  const dNewStockValue = dCurrentStockValue.plus(dIncomingAmount).toDecimalPlaces(2)

  // 库存为 0 时，成本直接等于进价
  const dNewCostPrice =
    dCurrentStock.isZero()
      ? dIncomingPrice
      : dNewStockValue.div(dNewStock)

  return {
    newCostPrice: toSafeNumber(dNewCostPrice),
    newStockValue: toSafeNumber(dNewStockValue),
    newStock: toSafeNumber(dNewStock),
  }
}

/**
 * 销售时按当前成本价计算销售成本
 *
 * @param currentCostPrice - 当前单位成本
 * @param saleQty - 销售数量
 * @returns costOfGoods 销售成本（即减少的库存金额）, stockValueReduction 库存金额减少额
 */
export function calculateSaleCost(
  currentCostPrice: number,
  saleQty: number,
): { costOfGoods: number; stockValueReduction: number } {
  const costOfGoods = toSafeNumber(
    new Decimal(currentCostPrice).mul(saleQty),
  )
  return { costOfGoods, stockValueReduction: costOfGoods }
}

/**
 * 退货时按原销售成本价退回
 *
 * 退货商品的成本按销售时的成本价恢复，不影响当前加权平均成本。
 *
 * @param costPriceAtSale - 销售时的单位成本价
 * @param returnQty - 退货数量
 * @returns costRefund 退回的库存金额
 */
export function calculateReturnCost(
  costPriceAtSale: number,
  returnQty: number,
): { costRefund: number } {
  return {
    costRefund: toSafeNumber(
      new Decimal(costPriceAtSale).mul(returnQty),
    ),
  }
}

/**
 * 库存调整时的成本变动
 *
 * 正数 adjustQty 表示盘盈（增加库存），负数表示盘亏（减少库存）。
 * 均按当前成本价计算库存金额变动。
 *
 * @param currentCostPrice - 当前单位成本
 * @param adjustQty - 调整数量（正数盘盈，负数盘亏）
 * @returns stockValueChange 库存金额变动
 */
export function calculateAdjustmentCost(
  currentCostPrice: number,
  adjustQty: number,
): { stockValueChange: number } {
  return {
    stockValueChange: toSafeNumber(
      new Decimal(currentCostPrice).mul(adjustQty),
    ),
  }
}
