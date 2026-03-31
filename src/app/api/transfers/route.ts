import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { generateOrderNo } from "@/lib/order-utils"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"
import { getPaginationParams } from "@/lib/pagination"

// 获取调拨单列表
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const { page, limit, skip } = getPaginationParams(url)

  try {
    const where = { tenantId: auth.tenantId }
    const [orders, total] = await Promise.all([
      prisma.transferOrder.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transferOrder.count({ where }),
    ])

    // 获取仓库名称
    const warehouseIds = [...new Set(orders.flatMap((o) => [o.fromWarehouseId, o.toWarehouseId]))]
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId: auth.tenantId, id: { in: warehouseIds } },
      select: { id: true, name: true },
    })
    const whMap = Object.fromEntries(warehouses.map((w) => [w.id, w.name]))

    // 获取商品名称
    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))]
    const products = await prisma.product.findMany({
      where: { tenantId: auth.tenantId, id: { in: productIds } },
      select: { id: true, name: true, unit: true },
    })
    const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))

    const enriched = orders.map((o) => ({
      ...o,
      fromWarehouseName: whMap[o.fromWarehouseId] || "未知",
      toWarehouseName: whMap[o.toWarehouseId] || "未知",
      items: o.items.map((i) => ({
        ...i,
        product: prodMap[i.productId] || null,
      })),
    }))

    return apiSuccess({ items: enriched, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("获取调拨单失败:", error)
    return apiError("获取调拨单失败", 500)
  }
}

// 创建调拨单
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { fromWarehouseId, toWarehouseId, items, notes } = body
    const transferPayloadItems: Array<{ productId?: string; quantity?: number }> =
      Array.isArray(items) ? items : []

    if (!fromWarehouseId) return apiError("请选择调出仓库")
    if (!toWarehouseId) return apiError("请选择调入仓库")
    if (fromWarehouseId === toWarehouseId) return apiError("调出和调入仓库不能相同")
    if (transferPayloadItems.length === 0) return apiError("请添加调拨商品")

    // 验证仓库归属
    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId: auth.tenantId } }),
      prisma.warehouse.findFirst({ where: { id: toWarehouseId, tenantId: auth.tenantId } }),
    ])
    if (!fromWh) return apiError("调出仓库不存在")
    if (!toWh) return apiError("调入仓库不存在")

    // 验证商品归属
    const productIds = [
      ...new Set(
        transferPayloadItems
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
      select: { id: true, name: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    // 验证商品和库存
    const transferItems: Array<{ productId: string; quantity: number }> = []
    for (const item of transferPayloadItems) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return apiError("调拨商品信息不完整")
      }
      const product = productMap.get(item.productId)
      if (!product) {
        return apiError("商品不存在或无权限")
      }
      // 检查调出仓库库存
      const whStock = await prisma.warehouseStock.findUnique({
        where: { warehouseId_productId: { warehouseId: fromWarehouseId, productId: item.productId } },
      })
      if (!whStock || whStock.quantity < item.quantity) {
        return apiError(`「${product.name}」在调出仓库库存不足`)
      }
      transferItems.push({ productId: item.productId, quantity: item.quantity })
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.transferOrder.create({
        data: {
          tenantId: auth.tenantId,
          transferNo: generateOrderNo("TF"),
          fromWarehouseId,
          toWarehouseId,
          notes: notes?.trim() || null,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
          items: {
            create: transferItems,
          },
        },
        include: { items: true },
      })

      // 创建库存流水：从调出仓库减 + 调入仓库加
      // 注意：Product.stock 总量不变，所以 transfer_out 和 transfer_in 互相抵消
      for (const item of transferItems) {
        // 调出：扣减总库存
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "transfer_out",
          quantity: -item.quantity,
          warehouseId: fromWarehouseId,
          refType: "transfer_order",
          refId: order.id,
          refNo: order.transferNo,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
        })
        // 调入：增加总库存（两者抵消，Product.stock 不变）
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: item.productId,
          type: "transfer_in",
          quantity: item.quantity,
          warehouseId: toWarehouseId,
          refType: "transfer_order",
          refId: order.id,
          refNo: order.transferNo,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
        })
      }

      return order
    })

    await logAudit(auth, "create", "warehouse", result.id,
      `创建调拨单 ${result.transferNo}，从「${fromWh.name}」调拨至「${toWh.name}」`)

    return apiSuccess(result, 201)
  } catch (error) {
    console.error("创建调拨单失败:", error)
    if (error instanceof Error && error.message) {
      if (error.message.includes("库存不足") || error.message.includes("无权限")) {
        return apiError(error.message)
      }
    }
    return apiError("创建调拨单失败", 500)
  }
}
