import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!existing) return apiError("客户不存在", 404)

    const body = await request.json()
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        phone: body.phone !== undefined ? body.phone?.trim() || null : existing.phone,
        address: body.address !== undefined ? body.address?.trim() || null : existing.address,
        customerType: body.customerType ?? existing.customerType,
        notes: body.notes !== undefined ? body.notes?.trim() || null : existing.notes,
      },
    })

    return apiSuccess(customer)
  } catch (error) {
    console.error("更新客户失败:", error)
    return apiError("更新客户失败", 500)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!existing) return apiError("客户不存在", 404)

    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    })

    return apiSuccess({ message: "删除成功" })
  } catch (error) {
    console.error("删除客户失败:", error)
    return apiError("删除客户失败", 500)
  }
}
