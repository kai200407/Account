import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { generateOrderNo } from "@/lib/order-utils"
import { logAudit } from "@/lib/audit"

// 获取销售单列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")
  const customerId = url.searchParams.get("customerId") ?? ""
  const saleType = url.searchParams.get("saleType") ?? ""

  try {
    const where = {
      tenantId: auth.tenantId,
      status: "completed",
      ...(customerId ? { customerId } : {}),
      ...(saleType ? { saleType } : {}),
    }

    const [orders, total] = await Promise.all([
      prisma.saleOrder.findMany({
        where,
        include: {
          customer: true,
          items: { include: { product: true } },
        },
        orderBy: { orderDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.saleOrder.count({ where }),
    ])

    return apiSuccess({
      items: orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取销售单失败:", error)
    return apiError("获取销售单失败", 500)
  }
}

// 创建销售单（事务：创建单据 + 扣库存 + 算利润 + 更新应收款）
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { customerId, saleType, items, paidAmount, notes, orderDate } = body

    if (!items || items.length === 0) return apiError("请添加销售商品")

    // 如果指定了客户，验证归属
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId: auth.tenantId },
      })
      if (!customer) return apiError("客户不存在")
    }

    // 构建订单项，检查库存，计算利润
    let totalAmount = 0
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
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return apiError("商品信息不完整")
      }

      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId: auth.tenantId },
      })
      if (!product) return apiError(`商品不存在`)
      if (product.stock < item.quantity) {
        return apiError(`「${product.name}」库存不足，当前库存 ${product.stock}${product.unit}`)
      }

      const unitPrice = item.unitPrice ?? 0
      const costPrice = Number(product.costPrice)
      const subtotal = item.quantity * unitPrice
      const profit = item.quantity * (unitPrice - costPrice)

      totalAmount += subtotal
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

    const paid = parseFloat(paidAmount) || 0
    const unpaid = totalAmount - paid
    const type = saleType || "retail"

    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建销售单
      const order = await tx.saleOrder.create({
        data: {
          tenantId: auth.tenantId,
          customerId: customerId || null,
          userId: auth.userId,
          orderNo: generateOrderNo("SO"),
          saleType: type,
          totalAmount,
          paidAmount: paid,
          profit: totalProfit,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
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

      // 2. 扣减库存
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }

      // 3. 更新客户应收余额（客户欠我的钱增加）
      if (unpaid > 0 && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: unpaid } },
        })
      }

      return order
    })

    await logAudit(auth, "create", "sale", result.id, `创建销售单 ${result.orderNo}，金额 ¥${Number(result.totalAmount).toFixed(2)}`)

    return apiSuccess(result, 201)
  } catch (error) {
    console.error("创建销售单失败:", error)
    return apiError("创建销售单失败", 500)
  }
}
