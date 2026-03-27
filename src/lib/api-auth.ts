import { NextRequest, NextResponse } from "next/server"
import { verifyToken, type JwtPayload } from "./auth"

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
export function requireAuth(request: NextRequest): JwtPayload | NextResponse {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { success: false, error: "未登录或登录已过期" },
      { status: 401 }
    )
  }
  return user
}

/**
 * 判断 requireAuth 返回的是用户还是错误响应
 */
export function isAuthError(
  result: JwtPayload | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
