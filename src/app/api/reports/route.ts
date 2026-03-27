import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const type = url.searchParams.get("type") ?? "profit"
  const startDate = url.searchParams.get("start") ?? ""
  const endDate = url.searchParams.get("end") ?? ""

  // 默认本月
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const start = startDate ? new Date(startDate) : defaultStart
  const end = endDate ? new Date(endDate + "T23:59:59") : defaultEnd

  const dateFilter = { gte: start, lte: end }

  try {
    if (type === "profit") {
      // 利润报表：按日汇总
      const sales = await prisma.saleOrder.findMany({
        where: {
          tenantId: auth.tenantId,
          status: "completed",
          orderDate: dateFilter,
        },
        select: {
          orderDate: true,
          totalAmount: true,
          profit: true,
          saleType: true,
        },
        orderBy: { orderDate: "asc" },
      })

      const purchases = await prisma.purchaseOrder.findMany({
        where: {
          tenantId: auth.tenantId,
          status: "completed",
          orderDate: dateFilter,
        },
        select: { totalAmount: true },
      })

      // 按日汇总
      const dailyMap = new Map<string, { revenue: number; profit: number; orders: number }>()

      for (const sale of sales) {
        const day = sale.orderDate.toISOString().slice(0, 10)
        const existing = dailyMap.get(day) ?? { revenue: 0, profit: 0, orders: 0 }
        dailyMap.set(day, {
          revenue: existing.revenue + Number(sale.totalAmount),
          profit: existing.profit + Number(sale.profit),
          orders: existing.orders + 1,
        })
      }

      const daily = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date))

      const totalRevenue = sales.reduce((s, o) => s + Number(o.totalAmount), 0)
      const totalProfit = sales.reduce((s, o) => s + Number(o.profit), 0)
      const totalPurchase = purchases.reduce((s, o) => s + Number(o.totalAmount), 0)
      const wholesaleRevenue = sales
        .filter((s) => s.saleType === "wholesale")
        .reduce((s, o) => s + Number(o.totalAmount), 0)
      const retailRevenue = totalRevenue - wholesaleRevenue

      return apiSuccess({
        totalRevenue,
        totalProfit,
        totalPurchase,
        wholesaleRevenue,
        retailRevenue,
        totalOrders: sales.length,
        daily,
      })
    }

    if (type === "products") {
      // 畅销/滞销分析
      const saleItems = await prisma.saleOrderItem.findMany({
        where: {
          saleOrder: {
            tenantId: auth.tenantId,
            status: "completed",
            orderDate: dateFilter,
          },
        },
        include: { product: true },
      })

      // 按商品汇总
      const productMap = new Map<string, {
        name: string
        totalQty: number
        totalRevenue: number
        totalProfit: number
      }>()

      for (const item of saleItems) {
        const key = item.productId
        const existing = productMap.get(key) ?? {
          name: item.product.name,
          totalQty: 0,
          totalRevenue: 0,
          totalProfit: 0,
        }
        productMap.set(key, {
          name: item.product.name,
          totalQty: existing.totalQty + item.quantity,
          totalRevenue: existing.totalRevenue + Number(item.subtotal),
          totalProfit: existing.totalProfit + Number(item.profit),
        })
      }

      const ranked = Array.from(productMap.values())
        .sort((a, b) => b.totalQty - a.totalQty)

      return apiSuccess({
        bestsellers: ranked.slice(0, 20),
        slowMoving: [...ranked].reverse().slice(0, 20),
      })
    }

    if (type === "customers") {
      // 客户统计
      const sales = await prisma.saleOrder.findMany({
        where: {
          tenantId: auth.tenantId,
          status: "completed",
          orderDate: dateFilter,
          customerId: { not: null },
        },
        include: { customer: true },
      })

      const customerMap = new Map<string, {
        name: string
        type: string
        totalAmount: number
        totalProfit: number
        orderCount: number
        balance: number
      }>()

      for (const sale of sales) {
        if (!sale.customer) continue
        const key = sale.customerId!
        const existing = customerMap.get(key) ?? {
          name: sale.customer.name,
          type: sale.customer.customerType,
          totalAmount: 0,
          totalProfit: 0,
          orderCount: 0,
          balance: Number(sale.customer.balance),
        }
        customerMap.set(key, {
          ...existing,
          totalAmount: existing.totalAmount + Number(sale.totalAmount),
          totalProfit: existing.totalProfit + Number(sale.profit),
          orderCount: existing.orderCount + 1,
        })
      }

      const ranked = Array.from(customerMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)

      return apiSuccess({ customers: ranked })
    }

    return apiError("未知报表类型")
  } catch (error) {
    console.error("获取报表失败:", error)
    return apiError("获取报表失败", 500)
  }
}
