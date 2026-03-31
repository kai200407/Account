import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取批次详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const batch = await prisma.batch.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { product: { select: { id: true, name: true, unit: true } } },
    })
    if (!batch) return apiError("批次不存在", 404)
    return apiSuccess(batch)
  } catch (error) {
    console.error("获取批次失败:", error)
    return apiError("获取批次失败", 500)
  }
}

// 更新批次（修改数量、备注等）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()
    const batch = await prisma.batch.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!batch) return apiError("批次不存在", 404)

    const updated = await prisma.batch.update({
      where: { id },
      data: {
        ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
        ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
      },
      include: { product: { select: { id: true, name: true, unit: true } } },
    })

    return apiSuccess(updated)
  } catch (error) {
    console.error("更新批次失败:", error)
    return apiError("更新批次失败", 500)
  }
}
