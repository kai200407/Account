import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

const CN_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" })

function formatCNDate(date: Date) {
  return CN_DATE_FORMATTER.format(date)
}

function parseCNDateRange(dateStr: string, end = false) {
  return new Date(`${dateStr}T${end ? "23:59:59" : "00:00:00"}+08:00`)
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const type = url.searchParams.get("type") ?? "profit"
  const startDate = url.searchParams.get("start") ?? ""
  const endDate = url.searchParams.get("end") ?? ""

  // 默认本月
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const start = startDate ? parseCNDateRange(startDate) : defaultStart
  const end = endDate ? parseCNDateRange(endDate, true) : defaultEnd

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
        const day = formatCNDate(sale.orderDate)
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

    // ==========================================
    // 出入库汇总报表
    // ==========================================
    if (type === "movements") {
      const movements = await prisma.stockMovement.findMany({
        where: {
          tenantId: auth.tenantId,
          createdAt: dateFilter,
        },
        include: { product: { select: { name: true, unit: true } } },
      })

      // 按类型汇总
      const byType: Record<string, { count: number; totalQty: number }> = {}
      for (const m of movements) {
        const t = m.type
        if (!byType[t]) byType[t] = { count: 0, totalQty: 0 }
        byType[t].count++
        byType[t].totalQty += Math.abs(m.quantity)
      }

      // 按商品汇总
      const byProduct = new Map<string, { name: string; inQty: number; outQty: number; movements: number }>()
      for (const m of movements) {
        const existing = byProduct.get(m.productId) ?? { name: m.product.name, inQty: 0, outQty: 0, movements: 0 }
        if (m.quantity > 0) existing.inQty += m.quantity
        else existing.outQty += Math.abs(m.quantity)
        existing.movements++
        byProduct.set(m.productId, existing)
      }

      const totalIn = movements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
      const totalOut = movements.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0)

      return apiSuccess({
        totalMovements: movements.length,
        totalIn,
        totalOut,
        byType: Object.entries(byType).map(([type, data]) => ({ type, ...data })),
        byProduct: Array.from(byProduct.values()).sort((a, b) => b.movements - a.movements).slice(0, 30),
      })
    }

    // ==========================================
    // 仓库利用率
    // ==========================================
    if (type === "warehouse_util") {
      const warehouses = await prisma.warehouse.findMany({
        where: { tenantId: auth.tenantId, isActive: true },
        include: { warehouseStocks: true },
      })

      const totalProducts = await prisma.product.count({
        where: { tenantId: auth.tenantId, isActive: true },
      })

      const warehouseData = warehouses.map((w) => {
        const activeStocks = w.warehouseStocks.filter((s) => s.quantity > 0)
        const totalQty = activeStocks.reduce((s, st) => s + st.quantity, 0)
        return {
          id: w.id,
          name: w.name,
          isDefault: w.isDefault,
          productCount: activeStocks.length,
          totalQuantity: totalQty,
          utilizationPct: totalProducts > 0 ? Math.round(activeStocks.length / totalProducts * 100) : 0,
        }
      })

      return apiSuccess({
        totalWarehouses: warehouses.length,
        totalProducts,
        warehouses: warehouseData,
      })
    }

    // ==========================================
    // 库存周转率
    // ==========================================
    if (type === "turnover") {
      // COGS (销售成本) = SUM(saleOrderItem.costPrice * quantity)
      const saleItems = await prisma.saleOrderItem.findMany({
        where: {
          saleOrder: { tenantId: auth.tenantId, status: "completed", orderDate: dateFilter },
        },
        select: { costPrice: true, quantity: true, productId: true },
      })

      const totalCOGS = saleItems.reduce((s, i) => s + Number(i.costPrice) * i.quantity, 0)

      // 当前库存金额（作为平均库存近似值）
      const products = await prisma.product.findMany({
        where: { tenantId: auth.tenantId, isActive: true },
        select: { id: true, name: true, stock: true, costPrice: true, category: { select: { name: true } } },
      })

      const avgInventory = products.reduce((s, p) => s + p.stock * Number(p.costPrice), 0)
      const turnoverRate = avgInventory > 0 ? totalCOGS / avgInventory : 0

      // 按商品的周转率
      const cogsMap = new Map<string, number>()
      for (const item of saleItems) {
        cogsMap.set(item.productId, (cogsMap.get(item.productId) ?? 0) + Number(item.costPrice) * item.quantity)
      }

      const productTurnover = products
        .map((p) => {
          const cogs = cogsMap.get(p.id) ?? 0
          const inv = p.stock * Number(p.costPrice)
          return {
            name: p.name,
            category: p.category?.name ?? "未分类",
            stock: p.stock,
            inventoryValue: inv,
            cogs,
            turnoverRate: inv > 0 ? Math.round(cogs / inv * 100) / 100 : 0,
          }
        })
        .sort((a, b) => b.turnoverRate - a.turnoverRate)

      // 计算天数范围
      const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      const daysOfInventory = turnoverRate > 0 ? Math.round(daysDiff / turnoverRate) : 999

      return apiSuccess({
        totalCOGS,
        avgInventory,
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        daysOfInventory,
        daysPeriod: daysDiff,
        byProduct: productTurnover.slice(0, 30),
      })
    }

    // ==========================================
    // 盘点差异报告
    // ==========================================
    if (type === "stocktake_variance") {
      const stocktakes = await prisma.stocktakeOrder.findMany({
        where: {
          tenantId: auth.tenantId,
          status: "completed",
          completedAt: dateFilter,
        },
        include: { items: true },
        orderBy: { completedAt: "desc" },
      })

      // 获取商品信息
      const productIds = [...new Set(stocktakes.flatMap((s) => s.items.map((i) => i.productId)))]
      const products = await prisma.product.findMany({
        where: { tenantId: auth.tenantId, id: { in: productIds } },
        select: { id: true, name: true, unit: true },
      })
      const prodMap = Object.fromEntries(products.map((p) => [p.id, p]))

      const allDiffItems = stocktakes.flatMap((s) =>
        s.items
          .filter((i) => i.diffQty !== null && i.diffQty !== 0)
          .map((i) => ({
            stocktakeNo: s.stocktakeNo,
            completedAt: s.completedAt,
            product: prodMap[i.productId] || { name: "未知", unit: "" },
            systemQty: i.systemQty,
            actualQty: i.actualQty!,
            diffQty: i.diffQty!,
          }))
      )

      const totalDiffItems = allDiffItems.length
      const totalPositive = allDiffItems.filter((i) => i.diffQty > 0).reduce((s, i) => s + i.diffQty, 0)
      const totalNegative = allDiffItems.filter((i) => i.diffQty < 0).reduce((s, i) => s + Math.abs(i.diffQty), 0)

      return apiSuccess({
        totalStocktakes: stocktakes.length,
        totalDiffItems,
        totalPositive,
        totalNegative,
        items: allDiffItems.slice(0, 50),
      })
    }

    // ==========================================
    // 批次效期报告
    // ==========================================
    if (type === "batch_expiry") {
      const batches = await prisma.batch.findMany({
        where: {
          tenantId: auth.tenantId,
          quantity: { gt: 0 },
          expiryDate: { not: null },
        },
        include: { product: { select: { id: true, name: true, unit: true, costPrice: true } } },
        orderBy: { expiryDate: "asc" },
      })

      const now = Date.now()
      const groups = { expired: [] as typeof enriched, within7: [] as typeof enriched, within30: [] as typeof enriched, safe: [] as typeof enriched }

      const enriched = batches.map((b) => {
        const daysLeft = b.expiryDate ? Math.ceil((b.expiryDate.getTime() - now) / 86400000) : 999
        return {
          ...b,
          daysLeft,
          value: b.quantity * Number(b.product.costPrice),
        }
      })

      for (const b of enriched) {
        if (b.daysLeft < 0) groups.expired.push(b)
        else if (b.daysLeft <= 7) groups.within7.push(b)
        else if (b.daysLeft <= 30) groups.within30.push(b)
        else groups.safe.push(b)
      }

      return apiSuccess({
        summary: {
          expired: { count: groups.expired.length, value: groups.expired.reduce((s, b) => s + b.value, 0) },
          within7: { count: groups.within7.length, value: groups.within7.reduce((s, b) => s + b.value, 0) },
          within30: { count: groups.within30.length, value: groups.within30.reduce((s, b) => s + b.value, 0) },
          safe: { count: groups.safe.length, value: groups.safe.reduce((s, b) => s + b.value, 0) },
        },
        items: enriched.slice(0, 50),
      })
    }

    return apiError("未知报表类型")
  } catch (error) {
    console.error("获取报表失败:", error)
    return apiError("获取报表失败", 500)
  }
}
