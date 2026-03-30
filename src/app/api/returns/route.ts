import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"

// 获取退货单列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")

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
        skip: (page - 1) * limit,
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
  const auth = requireAuth(request)
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

    // 事务
    const result = await prisma.$transaction(async (tx) => {
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

      // 2. 回滚库存：每个商品 stock += quantity
      for (const item of returnItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }

      // 3. 调减原销售单利润
      await tx.saleOrder.update({
        where: { id: saleOrderId },
        data: { profit: { decrement: totalProfitReduction } },
      })

      // 4. 调减客户应收余额（如果有赊账）
      if (saleOrder.customerId) {
        // 退货金额从客户欠款中扣减（退货相当于减少了客户的消费）
        await tx.customer.update({
          where: { id: saleOrder.customerId },
          data: { balance: { decrement: totalAmount } },
        })
      }

      return returnOrder
    })

    await logAudit(auth, "create", "return", result.id, `创建退货单 ${result.returnNo}，金额 ¥${Number(result.totalAmount).toFixed(2)}`)

    return apiSuccess(result, 201)
  } catch (error) {
    console.error("创建退货单失败:", error)
    return apiError("创建退货单失败", 500)
  }
}
