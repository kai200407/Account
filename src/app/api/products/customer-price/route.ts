import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

/**
 * GET /api/products/customer-price?customerId=xxx&productId=xxx
 * 查询某客户对某商品的专属价格（开单时使用）
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const customerId = url.searchParams.get("customerId")
  const productId = url.searchParams.get("productId")

  if (!customerId || !productId) {
    return apiError("缺少 customerId 或 productId 参数")
  }

  try {
    const customerPrice = await prisma.customerPrice.findFirst({
      where: {
        customerId,
        productId,
        tenantId: auth.tenantId,
      },
    })

    // 如果没有专属价格，返回 null，前端回退到商品默认价格
    return apiSuccess(customerPrice)
  } catch (error) {
    console.error("查询客户专属价格失败:", error)
    return apiError("查询客户专属价格失败", 500)
  }
}
