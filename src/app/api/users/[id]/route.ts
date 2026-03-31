import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashSync } from "bcryptjs"
import { requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 更新员工（启用/禁用、修改信息）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.user.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!existing) return apiError("员工不存在", 404)
    if (existing.role === "owner") return apiError("不能修改老板账号")

    const body = await request.json()

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    const action = body.isActive === false ? "禁用" : body.isActive === true ? "启用" : "更新"
    await logAudit(auth, "update", "user", id, `${action}员工「${user.name}」`)

    return apiSuccess(user)
  } catch (error) {
    console.error("更新员工失败:", error)
    return apiError("更新员工失败", 500)
  }
}

// 重置密码
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.user.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!existing) return apiError("员工不存在", 404)
    if (existing.role === "owner") return apiError("不能重置老板密码")

    const body = await request.json()
    const newPassword = body.password?.trim() || "123456"
    if (newPassword.length < 6) return apiError("密码至少6位")

    await prisma.user.update({
      where: { id },
      data: { password: hashSync(newPassword, 10) },
    })

    await logAudit(auth, "update", "user", id, `重置员工「${existing.name}」密码`)

    return apiSuccess({ message: "密码已重置" })
  } catch (error) {
    console.error("重置密码失败:", error)
    return apiError("重置密码失败", 500)
  }
}
