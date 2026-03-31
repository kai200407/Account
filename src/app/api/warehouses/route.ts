import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"

// 获取仓库列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })

    // 如果没有仓库，自动创建默认仓库
    if (warehouses.length === 0) {
      const defaultWarehouse = await prisma.warehouse.create({
        data: {
          tenantId: auth.tenantId,
          name: "默认仓库",
          isDefault: true,
        },
      })
      return apiSuccess([defaultWarehouse])
    }

    return apiSuccess(warehouses)
  } catch (error) {
    console.error("获取仓库列表失败:", error)
    return apiError("获取仓库列表失败", 500)
  }
}

// 创建仓库
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { name, address, contact, phone } = body

    if (!name?.trim()) return apiError("请输入仓库名称")

    // 检查重名
    const existing = await prisma.warehouse.findUnique({
      where: { tenantId_name: { tenantId: auth.tenantId, name: name.trim() } },
    })
    if (existing) return apiError("仓库名称已存在")

    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId: auth.tenantId,
        name: name.trim(),
        address: address?.trim() || null,
        contact: contact?.trim() || null,
        phone: phone?.trim() || null,
      },
    })

    await logAudit(auth, "create", "warehouse", warehouse.id, `创建仓库「${warehouse.name}」`)

    return apiSuccess(warehouse, 201)
  } catch (error) {
    console.error("创建仓库失败:", error)
    return apiError("创建仓库失败", 500)
  }
}
