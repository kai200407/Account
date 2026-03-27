import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

// 获取商品列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get("search") ?? ""
  const categoryId = url.searchParams.get("categoryId") ?? ""
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")

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

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    return apiSuccess({
      items: products,
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
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { name, sku, unit, categoryId, costPrice, wholesalePrice, retailPrice, specialPrice, stock, lowStockAlert, notes } = body

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
        notes: notes || null,
      },
      include: { category: true },
    })

    return apiSuccess(product, 201)
  } catch (error) {
    console.error("创建商品失败:", error)
    return apiError("创建商品失败", 500)
  }
}
