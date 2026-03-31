import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { generateOrderNo } from "@/lib/order-utils"
import { logAudit } from "@/lib/audit"

// 获取盘点单列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")
  const status = url.searchParams.get("status") ?? ""

  try {
    const where: Record<string, unknown> = { tenantId: auth.tenantId }
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      prisma.stocktakeOrder.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stocktakeOrder.count({ where }),
    ])

    return apiSuccess({ items: orders, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("获取盘点单失败:", error)
    return apiError("获取盘点单失败", 500)
  }
}

// 创建盘点单（草稿）— 自动加载当前库存作为 systemQty
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { warehouseId, productIds, notes } = body

    // 获取要盘点的商品
    const productWhere: Record<string, unknown> = {
      tenantId: auth.tenantId,
      isActive: true,
    }
    if (productIds?.length) {
      productWhere.id = { in: productIds }
    }

    const products = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, stock: true },
    })

    if (products.length === 0) return apiError("没有可盘点的商品")

    // 如果指定了仓库，用仓库库存作为 systemQty
    let systemQtyMap: Record<string, number> = {}
    if (warehouseId) {
      const whStocks = await prisma.warehouseStock.findMany({
        where: { warehouseId, productId: { in: products.map((p) => p.id) } },
      })
      systemQtyMap = Object.fromEntries(whStocks.map((s) => [s.productId, s.quantity]))
    }

    const order = await prisma.stocktakeOrder.create({
      data: {
        tenantId: auth.tenantId,
        warehouseId: warehouseId || null,
        stocktakeNo: generateOrderNo("ST"),
        notes: notes?.trim() || null,
        operatorId: auth.userId,
        operatorName: auth.userName || "未知用户",
        items: {
          create: products.map((p) => ({
            productId: p.id,
            systemQty: warehouseId ? (systemQtyMap[p.id] ?? 0) : p.stock,
          })),
        },
      },
      include: { items: true },
    })

    await logAudit(auth, "create", "warehouse", order.id, `创建盘点单 ${order.stocktakeNo}`)

    return apiSuccess(order, 201)
  } catch (error) {
    console.error("创建盘点单失败:", error)
    return apiError("创建盘点单失败", 500)
  }
}
