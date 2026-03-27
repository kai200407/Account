import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get("search") ?? ""

  try {
    const suppliers = await prisma.supplier.findMany({
      where: {
        tenantId: auth.tenantId,
        isActive: true,
        ...(search ? { name: { contains: search } } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    return apiSuccess(suppliers)
  } catch (error) {
    console.error("获取供应商失败:", error)
    return apiError("获取供应商失败", 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    if (!body.name?.trim()) return apiError("供应商名称不能为空")

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: auth.tenantId,
        name: body.name.trim(),
        contact: body.contact?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    })

    return apiSuccess(supplier, 201)
  } catch (error) {
    console.error("创建供应商失败:", error)
    return apiError("创建供应商失败", 500)
  }
}
