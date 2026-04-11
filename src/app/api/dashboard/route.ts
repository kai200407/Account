import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)
    const todayFilter = { gte: todayStart, lte: todayEnd }

    const tid = auth.tenantId

    // 并行查询
    const [todaySales, todayPurchases, lowStockProducts, lowStockCountResult, recentSales, totalReceivable, totalPayable, popularProductIds, stockValueResult, expiringBatches] = await Promise.all([
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
      // 低库存商品 Top5（按缺口从大到小）
      prisma.$queryRawUnsafe<Array<{ id: string; name: string; stock: number; unit: string; low_stock_alert: number }>>(
        `SELECT id, name, stock, unit, low_stock_alert
        FROM products
        WHERE tenant_id = ? AND is_active = 1 AND stock < low_stock_alert
        ORDER BY (low_stock_alert - stock) DESC
        LIMIT 5`,
        tid
      ),
      // 低库存商品总数
      prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
        `SELECT COUNT(*) as cnt FROM products WHERE tenant_id = ? AND is_active = 1 AND stock < low_stock_alert`,
        tid
      ),
      // 最近5笔销售
      prisma.saleOrder.findMany({
        where: { tenantId: tid, status: "completed" },
        select: {
          id: true, orderNo: true, totalAmount: true, profit: true,
          saleType: true, orderDate: true,
          customer: { select: { name: true } },
        },
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
      // 热门商品（近30天销量前8）
      prisma.saleOrderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        where: {
          saleOrder: {
            tenantId: tid,
            status: "completed",
            orderDate: { gte: new Date(Date.now() - 30 * 86400000) },
          },
        },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      }),
      // 库存总金额
      prisma.product.aggregate({
        where: { tenantId: tid, isActive: true },
        _sum: { stockValue: true },
      }),
      // 近30天过期批次数
      prisma.batch.count({
        where: {
          tenantId: tid,
          expiryDate: {
            gte: now,
            lte: new Date(Date.now() + 30 * 86400000),
          },
          remainingQty: { gt: 0 },
        },
      }),
    ])

    const todayRevenue = todaySales.reduce((s, o) => s + Number(o.totalAmount), 0)
    const todayProfit = todaySales.reduce((s, o) => s + Number(o.profit), 0)
    const todayPurchaseTotal = todayPurchases.reduce((s, o) => s + Number(o.totalAmount), 0)

    // 获取热门商品详情
    const popularIds = popularProductIds.map((p) => p.productId)
    let popularProducts: Array<{ id: string; name: string; retailPrice: number; imageUrl: string | null }> = []
    if (popularIds.length > 0) {
      const prods = await prisma.product.findMany({
        where: { tenantId: tid, id: { in: popularIds }, isActive: true },
        select: { id: true, name: true, retailPrice: true, imageUrl: true },
      })
      // 保持销量排序
      popularProducts = popularIds
        .map((id) => prods.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({
          id: p!.id,
          name: p!.name,
          retailPrice: Number(p!.retailPrice),
          imageUrl: p!.imageUrl,
        }))
    }

    return apiSuccess({
      todayRevenue,
      todayProfit,
      todayOrders: todaySales.length,
      todayPurchaseTotal,
      lowStockCount: Number(lowStockCountResult[0]?.cnt ?? 0),
      lowStockProducts: lowStockProducts.map((p) => ({
        name: p.name,
        stock: p.stock,
        unit: p.unit,
        lowStockAlert: p.low_stock_alert,
      })),
      totalStockValue: Number(stockValueResult._sum.stockValue ?? 0),
      expiringBatchCount: expiringBatches,
      totalReceivable: Number(totalReceivable._sum.balance ?? 0),
      totalPayable: Number(totalPayable._sum.balance ?? 0),
      popularProducts,
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
