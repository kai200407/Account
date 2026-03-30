import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { compareSync } from "bcryptjs"
import { signToken } from "@/lib/auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, password } = body

    if (!phone || !password) {
      return apiError("请输入手机号和密码")
    }

    // 查找用户（包含租户信息）
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { tenant: true },
    })

    if (!user) {
      return apiError("手机号或密码错误", 401)
    }

    if (!user.isActive) {
      return apiError("账号已被禁用", 403)
    }

    // 验证密码
    const isPasswordValid = compareSync(password, user.password)
    if (!isPasswordValid) {
      return apiError("手机号或密码错误", 401)
    }

    // 生成 JWT
    const token = signToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      userName: user.name,
    })

    return apiSuccess({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        shopName: user.tenant.name,
      },
    })
  } catch (error) {
    console.error("登录失败:", error)
    return apiError("登录失败，请稍后重试", 500)
  }
}
