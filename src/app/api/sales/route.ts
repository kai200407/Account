import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { generateOrderNo } from "@/lib/order-utils"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"
import { calculateSaleCost } from "@/lib/cost-calculation"
import { getPaginationParams } from "@/lib/pagination"
import { saleOrderSchema } from "@/lib/validations"
import { validateBody } from "@/lib/validate"

// 获取销售单列表
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const { page, limit, skip } = getPaginationParams(url)
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
        select: {
          id: true, orderNo: true, totalAmount: true, paidAmount: true,
          profit: true, status: true, orderDate: true, saleType: true,
          customer: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { orderDate: "desc" },
        skip,
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
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const validation = validateBody(saleOrderSchema, body)
    if (!validation.success) {
      return apiError(validation.error, 400)
    }
    const { customerId, saleType, items, paidAmount, notes, warehouseId } = validation.data
    const orderDate = body.orderDate

    // 如果指定了客户，验证归属
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId: auth.tenantId },
      })
      if (!customer) return apiError("客户不存在")
    }

    // 预检：验证商品存在且库存充足
    let totalAmount = 0
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return apiError("商品信息不完整")
      }

      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId: auth.tenantId },
        select: { id: true, stock: true, name: true, unit: true },
      })
      if (!product) return apiError("商品不存在")
      if (product.stock < item.quantity) {
        return apiError(`「${product.name}」库存不足，当前库存 ${product.stock}${product.unit}`)
      }

      totalAmount += item.quantity * (item.unitPrice ?? 0)
    }

    const paid = paidAmount ?? 0
    const unpaid = totalAmount - paid
    const type = saleType || "retail"

    const result = await prisma.$transaction(async (tx) => {
      // 事务内：读取最新成本数据，计算利润，构建订单项
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
          select: { id: true, costPrice: true },
        })
        if (!product) throw new Error("商品不存在")

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

      // 1. 创建销售单
      const order = await tx.saleOrder.create({
        data: {
          tenantId: auth.tenantId,
          customerId: customerId || null,
          userId: auth.userId,
          warehouseId: warehouseId || null,
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

      // 2. 扣减库存 + 成本核算（stock 和 stockValue 在 createStockMovement 中原子更新）
      for (const item of orderItems) {
        // 读取最新成本价
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { costPrice: true },
        })
        if (!product) throw new Error("商品不存在")

        const currentCostPrice = Number(product.costPrice)

        // 计算销售成本（库存金额减少量）
        const { stockValueReduction } = calculateSaleCost(currentCostPrice, item.quantity)

        // 扣减库存（通过库存流水），stock 和 stockValue 同一事务原子更新
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "sale_out",
          quantity: -item.quantity,
          warehouseId: warehouseId || undefined,
          refType: "sale_order",
          refId: order.id,
          refNo: order.orderNo,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
          costPrice: currentCostPrice,
          stockValueDelta: -stockValueReduction,
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
    if (error instanceof Error && error.message) {
      if (error.message.includes("库存不足") || error.message.includes("无权限")) {
        return apiError(error.message)
      }
    }
    return apiError("创建销售单失败", 500)
  }
}
