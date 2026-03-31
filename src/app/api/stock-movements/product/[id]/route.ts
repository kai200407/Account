import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取单个商品的库存流水
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")

  try {
    // 验证商品属于当前租户
    const product = await prisma.product.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, name: true, unit: true, stock: true },
    })
    if (!product) return apiError("商品不存在", 404)

    const where = { tenantId: auth.tenantId, productId: id }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ])

    return apiSuccess({
      product,
      items: movements,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取商品库存流水失败:", error)
    return apiError("获取商品库存流水失败", 500)
  }
}
