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
  const sort = url.searchParams.get("sort") ?? ""
  const limit = parseInt(url.searchParams.get("limit") ?? "0")

  try {
    // 按最近交易时间排序
    if (sort === "recent") {
      const recentCustomers = await prisma.saleOrder.groupBy({
        by: ["customerId"],
        where: {
          tenantId: auth.tenantId,
          status: "completed",
          customerId: { not: null },
        },
        _max: { orderDate: true },
        orderBy: { _max: { orderDate: "desc" } },
        take: limit || 5,
      })

      const customerIds = recentCustomers
        .map((r) => r.customerId)
        .filter((id): id is string => id !== null)

      if (customerIds.length > 0) {
        const customers = await prisma.customer.findMany({
          where: { id: { in: customerIds }, isActive: true },
        })

        // 保持最近交易排序
        const sorted = customerIds
          .map((id) => customers.find((c) => c.id === id))
          .filter(Boolean)

        return apiSuccess(sorted)
      }

      return apiSuccess([])
    }

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
