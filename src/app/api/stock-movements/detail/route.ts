import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { getPaginationParams } from "@/lib/pagination"

// 获取进销存明细账（流水明细）
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const { page, limit, skip } = getPaginationParams(url)
  const productId = url.searchParams.get("productId") ?? ""
  const warehouseId = url.searchParams.get("warehouseId") ?? ""
  const type = url.searchParams.get("type") ?? ""
  const startDate = url.searchParams.get("startDate") ?? ""
  const endDate = url.searchParams.get("endDate") ?? ""

  try {
    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
    }

    if (productId) where.productId = productId
    if (warehouseId) where.warehouseId = warehouseId
    if (type) where.type = type
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate + "T23:59:59") } : {}),
      }
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ])

    return apiSuccess({
      items: movements,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取进销存明细账失败:", error)
    return apiError("获取进销存明细账失败", 500)
  }
}
