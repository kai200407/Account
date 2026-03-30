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

    if (type === "trend") {
      // 月度趋势：最近6个月
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
        months.push({
          label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          start: monthStart,
          end: monthEnd,
        })
      }

      const monthlyData = await Promise.all(
        months.map(async (m) => {
          const sales = await prisma.saleOrder.findMany({
            where: {
              tenantId: auth.tenantId,
              status: "completed",
              orderDate: { gte: m.start, lte: m.end },
            },
            select: { totalAmount: true, profit: true },
          })

          const revenue = sales.reduce((s, o) => s + Number(o.totalAmount), 0)
          const profit = sales.reduce((s, o) => s + Number(o.profit), 0)

          return {
            month: m.label,
            revenue,
            profit,
            orders: sales.length,
          }
        })
      )

      // 本月 vs 上月对比
      const current = monthlyData[monthlyData.length - 1]
      const previous = monthlyData[monthlyData.length - 2]
      const comparison = {
        revenueChange: previous.revenue > 0
          ? ((current.revenue - previous.revenue) / previous.revenue * 100)
          : 0,
        profitChange: previous.profit > 0
          ? ((current.profit - previous.profit) / previous.profit * 100)
          : 0,
        ordersChange: previous.orders > 0
          ? ((current.orders - previous.orders) / previous.orders * 100)
          : 0,
      }

      return apiSuccess({ monthly: monthlyData, comparison })
    }

    if (type === "inventory") {
      // 库存金额统计
      const products = await prisma.product.findMany({
        where: { tenantId: auth.tenantId, isActive: true },
        include: { category: true },
      })

      let totalInventoryValue = 0
      const categoryMap = new Map<string, { name: string; value: number; count: number }>()

      for (const p of products) {
        const value = p.stock * Number(p.costPrice)
        totalInventoryValue += value

        const catName = p.category?.name ?? "未分类"
        const catId = p.categoryId ?? "none"
        const existing = categoryMap.get(catId) ?? { name: catName, value: 0, count: 0 }
        categoryMap.set(catId, {
          name: catName,
          value: existing.value + value,
          count: existing.count + p.stock,
        })
      }

      const byCategory = Array.from(categoryMap.values())
        .sort((a, b) => b.value - a.value)

      return apiSuccess({
        totalInventoryValue,
        totalProducts: products.length,
        totalStock: products.reduce((s, p) => s + p.stock, 0),
        byCategory,
      })
    }

    return apiError("未知报表类型")
  } catch (error) {
    console.error("获取报表失败:", error)
    return apiError("获取报表失败", 500)
  }
}
