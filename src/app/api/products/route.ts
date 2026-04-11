import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { getPaginationParams } from "@/lib/pagination"

/**
 * 过滤商品数据中的进价字段（staff 不可见）
 */
function filterCostPrice(product: Record<string, unknown>): Record<string, unknown> {
  const { costPrice, ...rest } = product
  void costPrice
  return rest
}

// 获取商品列表
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get("search") ?? ""
  const categoryId = url.searchParams.get("categoryId") ?? ""
  const { page, limit, skip } = getPaginationParams(url)
  const sort = url.searchParams.get("sort") ?? ""

  try {
    const where = {
      tenantId: auth.tenantId,
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { sku: { contains: search } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
    }

    // 支持按销量排序（常用商品）
    const orderBy: Record<string, unknown> = { createdAt: "desc" as const }
    if (sort === "popular") {
      // 按近30天销量排序：先获取商品 ID 列表
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const popularProducts = await prisma.saleOrderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        where: {
          saleOrder: {
            tenantId: auth.tenantId,
            status: "completed",
            orderDate: { gte: thirtyDaysAgo },
          },
        },
        orderBy: { _sum: { quantity: "desc" } },
        take: limit,
      })

      const popularIds = popularProducts.map((p) => p.productId)

      if (popularIds.length > 0) {
        const products = await prisma.product.findMany({
          where: { ...where, id: { in: popularIds } },
          select: {
            id: true, name: true, sku: true, unit: true, costPrice: true,
            retailPrice: true, stock: true, lowStockAlert: true, isActive: true,
            categoryId: true, imageUrl: true,
            category: { select: { id: true, name: true } },
          },
        })

        // 保持销量排序
        const sorted = popularIds
          .map((id) => products.find((p) => p.id === id))
          .filter(Boolean) as typeof products

        const isStaff = auth.role !== "owner"
        const items = isStaff
          ? sorted.map((p) => filterCostPrice(p as unknown as Record<string, unknown>))
          : sorted

        return apiSuccess({ items, total: sorted.length, page: 1, limit, totalPages: 1 })
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true, name: true, sku: true, unit: true, costPrice: true,
          retailPrice: true, stock: true, lowStockAlert: true, isActive: true,
          categoryId: true, imageUrl: true,
          category: { select: { id: true, name: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    const isStaff = auth.role !== "owner"
    const items = isStaff
      ? products.map((p) => filterCostPrice(p as unknown as Record<string, unknown>))
      : products

    return apiSuccess({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取商品列表失败:", error)
    return apiError("获取商品列表失败", 500)
  }
}

// 创建商品
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { name, sku, unit, categoryId, costPrice, wholesalePrice, retailPrice, specialPrice, stock, lowStockAlert, notes, imageUrl } = body

    if (!name) {
      return apiError("商品名称不能为空")
    }

    const product = await prisma.product.create({
      data: {
        tenantId: auth.tenantId,
        name,
        sku: sku || null,
        unit: unit || "个",
        categoryId: categoryId || null,
        costPrice: costPrice ?? 0,
        wholesalePrice: wholesalePrice ?? 0,
        retailPrice: retailPrice ?? 0,
        specialPrice: specialPrice ?? null,
        stock: stock ?? 0,
        lowStockAlert: lowStockAlert ?? 10,
        imageUrl: imageUrl || null,
        notes: notes || null,
      },
      include: { category: true },
    })

    await logAudit(auth, "create", "product", product.id, `创建商品「${name}」`)

    return apiSuccess(product, 201)
  } catch (error) {
    console.error("创建商品失败:", error)
    return apiError("创建商品失败", 500)
  }
}
