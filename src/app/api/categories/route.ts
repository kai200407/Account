import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const categories = await prisma.category.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { sortOrder: "asc" },
    })

    return apiSuccess(categories)
  } catch (error) {
    console.error("获取分类失败:", error)
    return apiError("获取分类失败", 500)
  }
}
