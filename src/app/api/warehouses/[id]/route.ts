import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取仓库详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!warehouse) return apiError("仓库不存在", 404)
    return apiSuccess(warehouse)
  } catch (error) {
    console.error("获取仓库失败:", error)
    return apiError("获取仓库失败", 500)
  }
}

// 更新仓库
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()
    const { name, address, contact, phone, isActive } = body

    const warehouse = await prisma.warehouse.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!warehouse) return apiError("仓库不存在", 404)

    // 检查重名
    if (name && name.trim() !== warehouse.name) {
      const existing = await prisma.warehouse.findUnique({
        where: { tenantId_name: { tenantId: auth.tenantId, name: name.trim() } },
      })
      if (existing) return apiError("仓库名称已存在")
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(contact !== undefined ? { contact: contact?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })

    await logAudit(auth, "update", "warehouse", id, `更新仓库「${updated.name}」`)

    return apiSuccess(updated)
  } catch (error) {
    console.error("更新仓库失败:", error)
    return apiError("更新仓库失败", 500)
  }
}

// 删除仓库 — 仅 owner
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!warehouse) return apiError("仓库不存在", 404)
    if (warehouse.isDefault) return apiError("默认仓库不能删除")

    // 检查仓库是否有库存
    const stockCount = await prisma.warehouseStock.count({
      where: { warehouseId: id, tenantId: auth.tenantId, quantity: { gt: 0 } },
    })
    if (stockCount > 0) return apiError("仓库还有库存，请先调拨清空后再删除")

    await prisma.warehouse.delete({ where: { id } })

    await logAudit(auth, "delete", "warehouse", id, `删除仓库「${warehouse.name}」`)

    return apiSuccess({ message: "仓库已删除" })
  } catch (error) {
    console.error("删除仓库失败:", error)
    return apiError("删除仓库失败", 500)
  }
}
