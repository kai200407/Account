import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashSync } from "bcryptjs"
import { requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"

// 获取员工列表（仅 owner）
export async function GET(request: NextRequest) {
  const auth = requireOwner(request)
  if (isAuthError(auth)) return auth

  try {
    const users = await prisma.user.findMany({
      where: { tenantId: auth.tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })

    return apiSuccess(users)
  } catch (error) {
    console.error("获取员工列表失败:", error)
    return apiError("获取员工列表失败", 500)
  }
}

// 创建员工（仅 owner）
export async function POST(request: NextRequest) {
  const auth = requireOwner(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { name, phone, password } = body

    if (!name?.trim()) return apiError("请输入员工姓名")
    if (!phone?.trim()) return apiError("请输入手机号")
    if (!/^1\d{10}$/.test(phone)) return apiError("手机号格式不正确")

    const pwd = password?.trim() || "123456"
    if (pwd.length < 6) return apiError("密码至少6位")

    // 检查手机号是否已注册
    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) return apiError("该手机号已被使用")

    const user = await prisma.user.create({
      data: {
        tenantId: auth.tenantId,
        name: name.trim(),
        phone: phone.trim(),
        password: hashSync(pwd, 10),
        role: "staff",
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

    await logAudit(auth, "create", "user", user.id, `创建员工「${user.name}」`)

    return apiSuccess(user, 201)
  } catch (error) {
    console.error("创建员工失败:", error)
    return apiError("创建员工失败", 500)
  }
}
