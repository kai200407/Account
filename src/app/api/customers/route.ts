import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get("search") ?? ""
  const type = url.searchParams.get("type") ?? ""

  try {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: auth.tenantId,
        isActive: true,
        ...(search ? { name: { contains: search } } : {}),
        ...(type ? { customerType: type } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    return apiSuccess(customers)
  } catch (error) {
    console.error("获取客户失败:", error)
    return apiError("获取客户失败", 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    if (!body.name?.trim()) return apiError("客户名称不能为空")

    const customer = await prisma.customer.create({
      data: {
        tenantId: auth.tenantId,
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        customerType: body.customerType || "retail",
        notes: body.notes?.trim() || null,
      },
    })

    return apiSuccess(customer, 201)
  } catch (error) {
    console.error("创建客户失败:", error)
    return apiError("创建客户失败", 500)
  }
}
