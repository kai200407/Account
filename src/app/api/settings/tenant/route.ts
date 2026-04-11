import { NextRequest } from "next/server"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  })

  if (!tenant) {
    return apiError("店铺不存在", 404)
  }

  return apiSuccess({
    id: tenant.id,
    name: tenant.name,
    createdAt: tenant.createdAt,
    memberCount: tenant._count.users,
  })
}

export async function PUT(request: NextRequest) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name } = body as { name?: string }

  if (!name || !name.trim()) {
    return apiError("店铺名称不能为空")
  }

  const trimmed = name.trim()
  if (trimmed.length > 50) {
    return apiError("店铺名称不能超过50个字符")
  }

  const tenant = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { name: trimmed },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  })

  return apiSuccess(tenant)
}
