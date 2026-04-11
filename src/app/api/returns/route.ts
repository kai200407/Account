import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"
import { calculateReturnCost } from "@/lib/cost-calculation"
import { getPaginationParams } from "@/lib/pagination"

// 获取退货单列表
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const { page, limit, skip } = getPaginationParams(url)

  try {
    const where = { tenantId: auth.tenantId }

    const [returns, total] = await Promise.all([
      prisma.returnOrder.findMany({
        where,
        include: {
          saleOrder: true,
          customer: true,
          items: { include: { product: true } },
        },
        orderBy: { returnDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.returnOrder.count({ where }),
    ])

    return apiSuccess({
      items: returns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取退货列表失败:", error)
    return apiError("获取退货列表失败", 500)
  }
}

// 创建退货单
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { saleOrderId, items, reason } = body

    if (!saleOrderId) return apiError("请指定原销售单")
    if (!items?.length) return apiError("请添加退货商品")

    // 查找原销售单
    const saleOrder = await prisma.saleOrder.findFirst({
      where: { id: saleOrderId, tenantId: auth.tenantId },
      include: { items: true },
    })

    if (!saleOrder) return apiError("原销售单不存在", 404)
    if (saleOrder.status === "cancelled") return apiError("已取消的订单不能退货")

    // 验证退货数量不超过销售数量
    for (const returnItem of items) {
      const saleItem = saleOrder.items.find(
        (si) => si.productId === returnItem.productId
      )
      if (!saleItem) {
        return apiError(`商品不在原销售单中`)
      }
      if (returnItem.quantity > saleItem.quantity) {
        return apiError(`退货数量不能超过销售数量`)
      }
      if (returnItem.quantity <= 0) {
        return apiError(`退货数量必须大于0`)
      }
    }

    // 生成退货单号
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    const count = await prisma.returnOrder.count({
      where: {
        tenantId: auth.tenantId,
        returnDate: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        },
      },
    })
    const returnNo = `RET${dateStr}${String(count + 1).padStart(3, "0")}`

    // 计算退货总金额和利润调减
    interface ReturnItemData {
      productId: string
      quantity: number
      unitPrice: number
      subtotal: number
      profitReduction: number
      costPrice: number
    }

    const returnItems: ReturnItemData[] = items.map((item: { productId: string; quantity: number }) => {
      const saleItem = saleOrder.items.find((si) => si.productId === item.productId)!
      const unitPrice = Number(saleItem.unitPrice)
      const costPrice = Number(saleItem.costPrice)
      const subtotal = unitPrice * item.quantity
      const profitReduction = (unitPrice - costPrice) * item.quantity
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        profitReduction,
        costPrice,
      }
    })

    const totalAmount = returnItems.reduce((sum: number, i) => sum + i.subtotal, 0)
    const totalProfitReduction = returnItems.reduce((sum: number, i) => sum + i.profitReduction, 0)

    const soldQtyMap = new Map(saleOrder.items.map((item) => [item.productId, item.quantity]))

    // 事务
    const result = await prisma.$transaction(async (tx) => {
      // 并发保护：校验累计退货数量不能超过原销售数量
      const returnedItems = await tx.returnOrderItem.findMany({
        where: {
          returnOrder: {
            saleOrderId,
            tenantId: auth.tenantId,
          },
        },
        select: { productId: true, quantity: true },
      })
      const returnedQtyMap = new Map<string, number>()
      for (const item of returnedItems) {
        returnedQtyMap.set(item.productId, (returnedQtyMap.get(item.productId) ?? 0) + item.quantity)
      }

      for (const item of returnItems) {
        const soldQty = soldQtyMap.get(item.productId) ?? 0
        const returnedQty = returnedQtyMap.get(item.productId) ?? 0
        if (returnedQty + item.quantity > soldQty) {
          throw new Error("累计退货数量不能超过销售数量")
        }
      }

      // 1. 创建退货单
      const returnOrder = await tx.returnOrder.create({
        data: {
          tenantId: auth.tenantId,
          saleOrderId,
          customerId: saleOrder.customerId,
          returnNo,
          totalAmount,
          reason: reason || null,
          items: {
            create: returnItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          saleOrder: true,
        },
      })

      // 2. 回滚库存 + 成本联动
      for (const item of returnItems) {
        // 2a. 读取当前商品的成本和库存
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId: auth.tenantId },
          select: { costPrice: true, stockValue: true, stock: true },
        })
        if (!product) throw new Error("商品不存在或无权限")

        // 2b. 按原销售成本价计算退回金额
        const { costRefund } = calculateReturnCost(item.costPrice, item.quantity)

        // 2c. 更新商品库存金额（stock 由 createStockMovement 处理）
        const newStockValue = Number(product.stockValue) + costRefund
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockValue: newStockValue,
          },
        })

        // 2d. 创建库存流水，带上 costPrice 和 stockValueAfter
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "return_in",
          quantity: item.quantity,
          refType: "return_order",
          refId: returnOrder.id,
          refNo: returnOrder.returnNo,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
          costPrice: item.costPrice,
          stockValueAfter: newStockValue,
        })
      }

      // 3. 调减原销售单利润
      await tx.saleOrder.update({
        where: { id: saleOrderId },
        data: { profit: { decrement: totalProfitReduction } },
      })

      // 4. 调减客户应收余额（如果有赊账，不允许余额为负）
      if (saleOrder.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: saleOrder.customerId, tenantId: auth.tenantId },
          select: { balance: true },
        })

        if (!customer) {
          throw new Error("客户不存在或无权限")
        }

        const currentBalance = Number(customer.balance)
        const decrementAmount = Math.min(currentBalance, totalAmount)

        if (decrementAmount > 0) {
          const updated = await tx.customer.updateMany({
            where: {
              id: saleOrder.customerId,
              tenantId: auth.tenantId,
              balance: { gte: decrementAmount },
            },
            data: { balance: { decrement: decrementAmount } },
          })

          if (updated.count !== 1) {
            throw new Error("客户欠款已变更，请重试")
          }
        }
      }

      return returnOrder
    })

    await logAudit(auth, "create", "return", result.id, `创建退货单 ${result.returnNo}，金额 ¥${Number(result.totalAmount).toFixed(2)}`)

    return apiSuccess(result, 201)
  } catch (error) {
    console.error("创建退货单失败:", error)
    if (error instanceof Error && error.message) {
      return apiError(error.message)
    }
    return apiError("创建退货单失败", 500)
  }
}
