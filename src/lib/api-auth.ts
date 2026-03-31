import { NextRequest, NextResponse } from "next/server"
import { verifyToken, type JwtPayload } from "./auth"
import { prisma } from "./prisma"

/**
 * 从请求中提取并验证 JWT，返回用户信息
 * 所有需要登录的 API 都通过这个函数获取当前用户
 */
export function getAuthUser(request: NextRequest): JwtPayload | null {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }
  const token = authHeader.slice(7)
  return verifyToken(token)
}

/**
 * 要求登录的 API 使用这个函数，未登录直接返回 401
 */
export async function requireAuth(request: NextRequest): Promise<JwtPayload | NextResponse> {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { success: false, error: "未登录或登录已过期" },
      { status: 401 }
    )
  }

  const currentUser = await prisma.user.findFirst({
    where: {
      id: user.userId,
      tenantId: user.tenantId,
      isActive: true,
    },
    select: {
      id: true,
      tenantId: true,
      role: true,
      name: true,
    },
  })

  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: "账号已失效，请重新登录" },
      { status: 401 }
    )
  }

  return {
    userId: currentUser.id,
    tenantId: currentUser.tenantId,
    role: currentUser.role,
    userName: currentUser.name,
  }
}

/**
 * 要求 owner 角色的 API 使用这个函数
 * 非 owner 返回 403
 */
export async function requireOwner(request: NextRequest): Promise<JwtPayload | NextResponse> {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  if (result.role !== "owner") {
    return NextResponse.json(
      { success: false, error: "权限不足，仅老板可操作" },
      { status: 403 }
    )
  }
  return result
}

/**
 * 判断 requireAuth 返回的是用户还是错误响应
 */
export function isAuthError(
  result: JwtPayload | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
