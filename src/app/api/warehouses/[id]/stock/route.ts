import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { getPaginationParams } from "@/lib/pagination"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取仓库库存列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  const url = new URL(request.url)
  const { page, limit, skip } = getPaginationParams(url)
  const search = url.searchParams.get("search") ?? ""

  try {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!warehouse) return apiError("仓库不存在", 404)

    let matchedProductIds: string[] | null = null
    if (search) {
      const matchedProducts = await prisma.product.findMany({
        where: {
          tenantId: auth.tenantId,
          isActive: true,
          name: { contains: search },
        },
        select: { id: true },
      })
      matchedProductIds = matchedProducts.map((p) => p.id)

      if (matchedProductIds.length === 0) {
        return apiSuccess({
          warehouse,
          items: [],
          total: 0,
          page,
          totalPages: 0,
        })
      }
    }

    // 查询该仓库有库存的商品
    const where: Record<string, unknown> = {
      warehouseId: id,
      tenantId: auth.tenantId,
      quantity: { gt: 0 },
      ...(matchedProductIds ? { productId: { in: matchedProductIds } } : {}),
    }

    const [stocks, total] = await Promise.all([
      prisma.warehouseStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.warehouseStock.count({ where }),
    ])

    // 获取商品信息
    const productIds = stocks.map((s) => s.productId)
    const products = await prisma.product.findMany({
      where: { tenantId: auth.tenantId, id: { in: productIds } },
      select: { id: true, name: true, unit: true, sku: true, stock: true },
    })
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

    const items = stocks.map((s) => ({
      ...s,
      product: productMap[s.productId] || null,
    }))

    return apiSuccess({
      warehouse,
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取仓库库存失败:", error)
    return apiError("获取仓库库存失败", 500)
  }
}
