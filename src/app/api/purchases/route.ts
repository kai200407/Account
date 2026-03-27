import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { generateOrderNo } from "@/lib/order-utils"

// 获取进货单列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")
  const supplierId = url.searchParams.get("supplierId") ?? ""

  try {
    const where = {
      tenantId: auth.tenantId,
      status: "completed",
      ...(supplierId ? { supplierId } : {}),
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
        orderBy: { orderDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return apiSuccess({
      items: orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取进货单失败:", error)
    return apiError("获取进货单失败", 500)
  }
}

// 创建进货单（事务：创建单据 + 增加库存 + 更新应付款）
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { supplierId, items, paidAmount, notes, orderDate } = body

    if (!supplierId) return apiError("请选择供应商")
    if (!items || items.length === 0) return apiError("请添加进货商品")

    // 验证供应商属于当前租户
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: auth.tenantId },
    })
    if (!supplier) return apiError("供应商不存在")

    // 计算总金额
    let totalAmount = 0
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
      totalAmount += subtotal
      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        subtotal,
      })
    }

    const paid = parseFloat(paidAmount) || 0
    const unpaid = totalAmount - paid

    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建进货单
      const order = await tx.purchaseOrder.create({
        data: {
          tenantId: auth.tenantId,
          supplierId,
          orderNo: generateOrderNo("PO"),
          totalAmount,
          paidAmount: paid,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
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

      // 2. 增加库存
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }

      // 3. 更新供应商应付余额（欠供应商的钱增加）
      if (unpaid > 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { balance: { increment: unpaid } },
        })
      }

      return order
    })

    return apiSuccess(result, 201)
  } catch (error) {
    console.error("创建进货单失败:", error)
    return apiError("创建进货单失败", 500)
  }
}
