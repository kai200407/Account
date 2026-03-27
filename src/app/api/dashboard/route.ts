import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)
    const todayFilter = { gte: todayStart, lte: todayEnd }

    const tid = auth.tenantId

    // 并行查询
    const [todaySales, todayPurchases, lowStockProducts, recentSales, totalReceivable, totalPayable] = await Promise.all([
      // 今日销售
      prisma.saleOrder.findMany({
        where: { tenantId: tid, status: "completed", orderDate: todayFilter },
        select: { totalAmount: true, profit: true },
      }),
      // 今日进货
      prisma.purchaseOrder.findMany({
        where: { tenantId: tid, status: "completed", orderDate: todayFilter },
        select: { totalAmount: true },
      }),
      // 低库存商品
      prisma.$queryRawUnsafe<Array<{ id: string; name: string; stock: number; unit: string; low_stock_alert: number }>>(
        `SELECT id, name, stock, unit, low_stock_alert FROM products WHERE tenant_id = ? AND is_active = 1 AND stock <= low_stock_alert`,
        tid
      ),
      // 最近5笔销售
      prisma.saleOrder.findMany({
        where: { tenantId: tid, status: "completed" },
        include: { customer: true },
        orderBy: { orderDate: "desc" },
        take: 5,
      }),
      // 应收总额
      prisma.customer.aggregate({
        where: { tenantId: tid, isActive: true, balance: { gt: 0 } },
        _sum: { balance: true },
      }),
      // 应付总额
      prisma.supplier.aggregate({
        where: { tenantId: tid, isActive: true, balance: { gt: 0 } },
        _sum: { balance: true },
      }),
    ])

    const todayRevenue = todaySales.reduce((s, o) => s + Number(o.totalAmount), 0)
    const todayProfit = todaySales.reduce((s, o) => s + Number(o.profit), 0)
    const todayPurchaseTotal = todayPurchases.reduce((s, o) => s + Number(o.totalAmount), 0)

    return apiSuccess({
      todayRevenue,
      todayProfit,
      todayOrders: todaySales.length,
      todayPurchaseTotal,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 5),
      totalReceivable: Number(totalReceivable._sum.balance ?? 0),
      totalPayable: Number(totalPayable._sum.balance ?? 0),
      recentSales: recentSales.map((s) => ({
        id: s.id,
        orderNo: s.orderNo,
        customerName: s.customer?.name ?? "散客",
        totalAmount: Number(s.totalAmount),
        profit: Number(s.profit),
        saleType: s.saleType,
        orderDate: s.orderDate,
      })),
    })
  } catch (error) {
    console.error("获取仪表板数据失败:", error)
    return apiError("获取仪表板数据失败", 500)
  }
}
