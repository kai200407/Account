import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

// 获取审计日志（仅 owner）
export async function GET(request: NextRequest) {
  const auth = requireOwner(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const entity = url.searchParams.get("entity") ?? ""
  const userId = url.searchParams.get("userId") ?? ""
  const startDate = url.searchParams.get("startDate") ?? ""
  const endDate = url.searchParams.get("endDate") ?? ""
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")

  try {
    const where = {
      tenantId: auth.tenantId,
      ...(entity ? { entity } : {}),
      ...(userId ? { userId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate
                ? { lte: new Date(new Date(endDate).getTime() + 86400000) }
                : {}),
            },
          }
        : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return apiSuccess({
      items: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取审计日志失败:", error)
    return apiError("获取审计日志失败", 500)
  }
}
