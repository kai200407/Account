import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.supplier.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!existing) return apiError("供应商不存在", 404)

    const body = await request.json()
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        contact: body.contact !== undefined ? body.contact?.trim() || null : existing.contact,
        phone: body.phone !== undefined ? body.phone?.trim() || null : existing.phone,
        address: body.address !== undefined ? body.address?.trim() || null : existing.address,
        notes: body.notes !== undefined ? body.notes?.trim() || null : existing.notes,
      },
    })

    await logAudit(auth, "update", "supplier", id, `更新供应商「${supplier.name}」`)

    return apiSuccess(supplier)
  } catch (error) {
    console.error("更新供应商失败:", error)
    return apiError("更新供应商失败", 500)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const existing = await prisma.supplier.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!existing) return apiError("供应商不存在", 404)

    await prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    })

    await logAudit(auth, "delete", "supplier", id, `删除供应商「${existing.name}」`)

    return apiSuccess({ message: "删除成功" })
  } catch (error) {
    console.error("删除供应商失败:", error)
    return apiError("删除供应商失败", 500)
  }
}
