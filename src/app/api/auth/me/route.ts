import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (isAuthError(authResult)) return authResult

    const user = await prisma.user.findFirst({
      where: { id: authResult.userId, tenantId: authResult.tenantId, isActive: true },
      include: { tenant: true },
    })

    if (!user) {
      return apiError("用户不存在", 404)
    }

    return apiSuccess({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      shopName: user.tenant.name,
      tenantId: user.tenantId,
    })
  } catch (error) {
    console.error("获取用户信息失败:", error)
    return apiError("获取用户信息失败", 500)
  }
}
