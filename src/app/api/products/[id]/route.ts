import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取单个商品
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const product = await prisma.product.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { category: true },
    })

    if (!product) {
      return apiError("商品不存在", 404)
    }

    return apiSuccess(product)
  } catch (error) {
    console.error("获取商品失败:", error)
    return apiError("获取商品失败", 500)
  }
}

// 更新商品
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.product.findFirst({
      where: { id, tenantId: auth.tenantId },
    })

    if (!existing) {
      return apiError("商品不存在", 404)
    }

    const body = await request.json()
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        sku: body.sku !== undefined ? body.sku || null : existing.sku,
        unit: body.unit ?? existing.unit,
        categoryId: body.categoryId !== undefined ? body.categoryId || null : existing.categoryId,
        costPrice: body.costPrice ?? existing.costPrice,
        wholesalePrice: body.wholesalePrice ?? existing.wholesalePrice,
        retailPrice: body.retailPrice ?? existing.retailPrice,
        specialPrice: body.specialPrice !== undefined ? body.specialPrice : existing.specialPrice,
        stock: body.stock ?? existing.stock,
        lowStockAlert: body.lowStockAlert ?? existing.lowStockAlert,
        notes: body.notes !== undefined ? body.notes || null : existing.notes,
      },
      include: { category: true },
    })

    return apiSuccess(product)
  } catch (error) {
    console.error("更新商品失败:", error)
    return apiError("更新商品失败", 500)
  }
}

// 删除商品（软删除）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.product.findFirst({
      where: { id, tenantId: auth.tenantId },
    })

    if (!existing) {
      return apiError("商品不存在", 404)
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })

    return apiSuccess({ message: "删除成功" })
  } catch (error) {
    console.error("删除商品失败:", error)
    return apiError("删除商品失败", 500)
  }
}
