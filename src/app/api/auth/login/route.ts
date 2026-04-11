import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { compareSync } from "bcryptjs"
import { signToken } from "@/lib/auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { checkRateLimit, recordFailedAttempt, resetAttempts } from "@/lib/rate-limiter"

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, password } = body

    if (!phone || !password) {
      return apiError("请输入手机号和密码")
    }

    const ip = getClientIp(request)
    const rateLimitKey = `${phone}:${ip}`

    // 检查限流
    const rateLimitResult = checkRateLimit(rateLimitKey)
    if (!rateLimitResult.allowed) {
      return Response.json(
        { success: false, error: `登录尝试过多，请${rateLimitResult.retryAfter}秒后重试` },
        { status: 429 }
      )
    }

    // 查找用户（包含租户信息）
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { tenant: true },
    })

    if (!user) {
      recordFailedAttempt(rateLimitKey)
      await prisma.auditLog.create({
        data: {
          tenantId: "",
          userId: "",
          userName: "",
          action: "login_failed",
          entity: "user",
          entityId: null,
          summary: `手机号${phone}登录失败，IP: ${ip}`,
        },
      }).catch(() => {})
      return apiError("手机号或密码错误", 401)
    }

    if (!user.isActive) {
      return apiError("账号已被禁用", 403)
    }

    // 验证密码
    const isPasswordValid = compareSync(password, user.password)
    if (!isPasswordValid) {
      recordFailedAttempt(rateLimitKey)
      await prisma.auditLog.create({
        data: {
          tenantId: "",
          userId: "",
          userName: "",
          action: "login_failed",
          entity: "user",
          entityId: user.id,
          summary: `手机号${phone}登录失败，IP: ${ip}`,
        },
      }).catch(() => {})
      return apiError("手机号或密码错误", 401)
    }

    // 登录成功，重置限流
    resetAttempts(rateLimitKey)

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
