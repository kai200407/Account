import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/customers/[id]/prices
 * 获取某客户的所有专属价格
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!customer) return apiError("客户不存在", 404)

    const prices = await prisma.customerPrice.findMany({
      where: { customerId: id, tenantId: auth.tenantId },
      include: {
        product: {
          select: { id: true, name: true, sku: true, unit: true, retailPrice: true, wholesalePrice: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return apiSuccess(prices)
  } catch (error) {
    console.error("获取客户专属价格失败:", error)
    return apiError("获取客户专属价格失败", 500)
  }
}

/**
 * POST /api/customers/[id]/prices
 * 为客户设置商品专属价格（支持批量）
 * body: { prices: [{ productId, price }] }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!customer) return apiError("客户不存在", 404)

    const body = await request.json()
    const prices: { productId: string; price: number }[] = body.prices

    if (!Array.isArray(prices) || prices.length === 0) {
      return apiError("prices 不能为空")
    }

    // 校验商品属于当前租户
    const productIds = prices.map((p) => p.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: auth.tenantId },
      select: { id: true, name: true },
    })
    const validIds = new Set(products.map((p) => p.id))

    const results = []

    for (const item of prices) {
      if (!validIds.has(item.productId)) continue
      if (item.price == null || item.price < 0) continue

      const cp = await prisma.customerPrice.upsert({
        where: {
          customerId_productId: { customerId: id, productId: item.productId },
        },
        update: { price: item.price },
        create: {
          tenantId: auth.tenantId,
          customerId: id,
          productId: item.productId,
          price: item.price,
        },
      })
      results.push(cp)
    }

    await logAudit(auth, "update", "customer", id, `设置客户「${customer.name}」专属价格 ${results.length} 条`)

    return apiSuccess(results, 201)
  } catch (error) {
    console.error("设置客户专属价格失败:", error)
    return apiError("设置客户专属价格失败", 500)
  }
}

/**
 * DELETE /api/customers/[id]/prices?priceId=xxx
 * 删除某个专属价格
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const priceId = new URL(request.url).searchParams.get("priceId")
    if (!priceId) return apiError("缺少 priceId 参数")

    const existing = await prisma.customerPrice.findFirst({
      where: { id: priceId, customerId: id, tenantId: auth.tenantId },
    })
    if (!existing) return apiError("专属价格不存在", 404)

    await prisma.customerPrice.delete({ where: { id: priceId } })

    const customer = await prisma.customer.findFirst({ where: { id, tenantId: auth.tenantId } })
    await logAudit(auth, "delete", "customer", id, `删除客户「${customer?.name}」专属价格`)

    return apiSuccess({ message: "删除成功" })
  } catch (error) {
    console.error("删除客户专属价格失败:", error)
    return apiError("删除客户专属价格失败", 500)
  }
}
