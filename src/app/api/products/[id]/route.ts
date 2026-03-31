import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { createStockMovement } from "@/lib/stock"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取单个商品
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
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

    // staff 不返回进价
    if (auth.role !== "owner") {
      const { costPrice, ...rest } = product as unknown as Record<string, unknown>
      void costPrice
      return apiSuccess(rest)
    }

    return apiSuccess(product)
  } catch (error) {
    console.error("获取商品失败:", error)
    return apiError("获取商品失败", 500)
  }
}

// 更新商品
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
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
    const requestedStock = body.stock !== undefined ? Number(body.stock) : undefined
    if (requestedStock !== undefined && (!Number.isInteger(requestedStock) || requestedStock < 0)) {
      return apiError("库存必须是大于等于0的整数")
    }

    // staff 不能修改进价
    const costPrice = auth.role === "owner"
      ? (body.costPrice ?? existing.costPrice)
      : existing.costPrice

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: body.name ?? existing.name,
          sku: body.sku !== undefined ? body.sku || null : existing.sku,
          unit: body.unit ?? existing.unit,
          categoryId: body.categoryId !== undefined ? body.categoryId || null : existing.categoryId,
          costPrice,
          wholesalePrice: body.wholesalePrice ?? existing.wholesalePrice,
          retailPrice: body.retailPrice ?? existing.retailPrice,
          specialPrice: body.specialPrice !== undefined ? body.specialPrice : existing.specialPrice,
          lowStockAlert: body.lowStockAlert ?? existing.lowStockAlert,
          notes: body.notes !== undefined ? body.notes || null : existing.notes,
          imageUrl: body.imageUrl !== undefined ? body.imageUrl || null : existing.imageUrl,
        },
      })

      if (requestedStock !== undefined && requestedStock !== existing.stock) {
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: id,
          type: "adjustment",
          quantity: requestedStock - existing.stock,
          refType: "manual",
          refId: id,
          refNo: existing.sku || id,
          notes: `商品编辑调整库存 ${existing.stock} -> ${requestedStock}`,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
        })
      }

      return tx.product.findUnique({
        where: { id },
        include: { category: true },
      })
    })
    if (!product) return apiError("商品不存在", 404)

    await logAudit(auth, "update", "product", id, `更新商品「${product.name}」`)

    return apiSuccess(product)
  } catch (error) {
    console.error("更新商品失败:", error)
    return apiError("更新商品失败", 500)
  }
}

// 删除商品（软删除）— 仅 owner
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
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

    await logAudit(auth, "delete", "product", id, `删除商品「${existing.name}」`)

    return apiSuccess({ message: "删除成功" })
  } catch (error) {
    console.error("删除商品失败:", error)
    return apiError("删除商品失败", 500)
  }
}
