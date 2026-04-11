import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { generateOrderNo } from "@/lib/order-utils"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"
import { calculateWeightedAverageCost } from "@/lib/cost-calculation"
import { getPaginationParams } from "@/lib/pagination"
import { purchaseOrderSchema } from "@/lib/validations"
import { validateBody } from "@/lib/validate"

// 获取进货单列表
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const { page, limit, skip } = getPaginationParams(url)
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
        select: {
          id: true, orderNo: true, totalAmount: true, paidAmount: true,
          status: true, orderDate: true,
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { orderDate: "desc" },
        skip,
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
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const validation = validateBody(purchaseOrderSchema, body)
    if (!validation.success) {
      return apiError(validation.error, 400)
    }
    const { supplierId, items, paidAmount, notes, warehouseId } = validation.data
    const orderDate = body.orderDate
    const purchaseItems = items

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

    const productIds = [
      ...new Set(
        purchaseItems
          .map((item: { productId?: string }) => item.productId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ]
    const products = await prisma.product.findMany({
      where: {
        tenantId: auth.tenantId,
        isActive: true,
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        enableBatchTracking: true,
      },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const item of purchaseItems) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return apiError("商品信息不完整")
      }
      if (!productMap.has(item.productId)) {
        return apiError("商品不存在或无权限")
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

    const paid = paidAmount ?? 0
    const unpaid = totalAmount - paid

    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建进货单
      const order = await tx.purchaseOrder.create({
        data: {
          tenantId: auth.tenantId,
          supplierId,
          warehouseId: warehouseId || null,
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

      // 2. 增加库存 + 成本核算
      for (const item of orderItems) {
        // 事务内读取最新数据（避免使用事务外缓存）
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, costPrice: true, stockValue: true, enableBatchTracking: true },
        })
        if (!product) throw new Error("商品不存在")

        // 2a. 计算加权平均成本
        const costResult = calculateWeightedAverageCost({
          currentStock: product.stock,
          currentCostPrice: Number(product.costPrice),
          currentStockValue: Number(product.stockValue),
          incomingQty: item.quantity,
          incomingPrice: item.unitPrice,
        })

        // 2b. 更新商品成本价和最近进价（stockValue 由 createStockMovement 原子更新）
        await tx.product.update({
          where: { id: item.productId },
          data: {
            costPrice: costResult.newCostPrice,
            lastCostPrice: item.unitPrice,
          },
        })

        // 2c. 创建库存流水，stock 和 stockValue 同一事务原子更新
        const incomingAmount = item.quantity * item.unitPrice
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "purchase_in",
          quantity: item.quantity,
          warehouseId: warehouseId || undefined,
          refType: "purchase_order",
          refId: order.id,
          refNo: order.orderNo,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
          costPrice: costResult.newCostPrice,
          stockValueDelta: incomingAmount,
        })

        // 2d. 批次追踪：创建批次记录
        if (product.enableBatchTracking) {
          await tx.batch.create({
            data: {
              tenantId: auth.tenantId,
              productId: item.productId,
              batchNo: order.orderNo,
              quantity: item.quantity,
              costPrice: item.unitPrice,
              remainingQty: item.quantity,
              purchaseOrderId: order.id,
            },
          })
        }
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

    await logAudit(auth, "create", "purchase", result.id, `创建进货单 ${result.orderNo}，金额 ¥${Number(result.totalAmount).toFixed(2)}`)

    return apiSuccess(result, 201)
  } catch (error) {
    console.error("创建进货单失败:", error)
    return apiError("创建进货单失败", 500)
  }
}
