import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

// 获取批次列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")
  const productId = url.searchParams.get("productId") ?? ""
  const expiringSoon = url.searchParams.get("expiringSoon") === "true"

  try {
    const where: Record<string, unknown> = { tenantId: auth.tenantId }
    if (productId) where.productId = productId

    // 临期预警：30天内过期且库存>0
    if (expiringSoon) {
      const thirtyDaysLater = new Date(Date.now() + 30 * 86400000)
      where.expiryDate = { lte: thirtyDaysLater, not: null }
      where.quantity = { gt: 0 }
    }

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        include: { product: { select: { id: true, name: true, unit: true } } },
        orderBy: expiringSoon ? { expiryDate: "asc" } : { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.batch.count({ where }),
    ])

    return apiSuccess({ items: batches, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("获取批次列表失败:", error)
    return apiError("获取批次列表失败", 500)
  }
}

// 创建批次（通常在采购入库时调用）
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { productId, batchNo, quantity, productionDate, expiryDate, purchaseOrderId, notes } = body

    if (!productId) return apiError("请指定商品")
    if (!batchNo?.trim()) return apiError("请输入批次号")
    if (!quantity || quantity <= 0) return apiError("数量必须大于0")

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: auth.tenantId },
    })
    if (!product) return apiError("商品不存在", 404)

    const batch = await prisma.batch.create({
      data: {
        tenantId: auth.tenantId,
        productId,
        batchNo: batchNo.trim(),
        quantity,
        productionDate: productionDate ? new Date(productionDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        purchaseOrderId: purchaseOrderId || null,
        notes: notes?.trim() || null,
      },
      include: { product: { select: { id: true, name: true, unit: true } } },
    })

    return apiSuccess(batch, 201)
  } catch (error) {
    console.error("创建批次失败:", error)
    return apiError("创建批次失败", 500)
  }
}
