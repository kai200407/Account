import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.transferOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    })
    if (!order) return apiError("调拨单不存在", 404)

    // Enrich with names
    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: order.fromWarehouseId, tenantId: auth.tenantId }, select: { name: true } }),
      prisma.warehouse.findFirst({ where: { id: order.toWarehouseId, tenantId: auth.tenantId }, select: { name: true } }),
    ])

    const productIds = order.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { tenantId: auth.tenantId, id: { in: productIds } },
      select: { id: true, name: true, unit: true },
    })
    const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))

    return apiSuccess({
      ...order,
      fromWarehouseName: fromWh?.name || "未知",
      toWarehouseName: toWh?.name || "未知",
      items: order.items.map((i) => ({ ...i, product: prodMap[i.productId] || null })),
    })
  } catch (error) {
    console.error("获取调拨单失败:", error)
    return apiError("获取调拨单失败", 500)
  }
}
