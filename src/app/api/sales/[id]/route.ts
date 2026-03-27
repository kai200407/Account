import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const order = await prisma.saleOrder.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        customer: true,
        user: true,
        items: { include: { product: true } },
      },
    })

    if (!order) return apiError("销售单不存在", 404)
    return apiSuccess(order)
  } catch (error) {
    console.error("获取销售单失败:", error)
    return apiError("获取销售单失败", 500)
  }
}
