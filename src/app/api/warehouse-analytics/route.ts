import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const type = url.searchParams.get("type") ?? "reorder"
  const tid = auth.tenantId

  try {
    // ==========================================
    // 智能补货建议
    // ==========================================
    if (type === "reorder") {
      // 低库存商品 + 最近供应商/价格
      const lowStockProducts = await prisma.product.findMany({
        where: { tenantId: tid, isActive: true },
        select: {
          id: true, name: true, unit: true, stock: true, lowStockAlert: true, costPrice: true,
          category: { select: { name: true } },
        },
      })

      const needReorder = lowStockProducts.filter((p) => p.stock <= p.lowStockAlert)

      // 查最近一次采购记录（获取供应商和价格）
      const reorderSuggestions = await Promise.all(
        needReorder.map(async (p) => {
          const lastPurchaseItem = await prisma.purchaseOrderItem.findFirst({
            where: { productId: p.id, purchaseOrder: { tenantId: tid, status: "completed" } },
            include: { purchaseOrder: { include: { supplier: { select: { id: true, name: true } } } } },
            orderBy: { purchaseOrder: { orderDate: "desc" } },
          })

          // 推荐补货量：低库存警戒值的2倍 - 当前库存
          const suggestedQty = Math.max(p.lowStockAlert * 2 - p.stock, p.lowStockAlert)

          return {
            product: { id: p.id, name: p.name, unit: p.unit, category: p.category?.name },
            currentStock: p.stock,
            lowStockAlert: p.lowStockAlert,
            suggestedQty,
            lastSupplier: lastPurchaseItem?.purchaseOrder?.supplier || null,
            lastPrice: lastPurchaseItem ? Number(lastPurchaseItem.unitPrice) : Number(p.costPrice),
            estimatedCost: suggestedQty * (lastPurchaseItem ? Number(lastPurchaseItem.unitPrice) : Number(p.costPrice)),
          }
        })
      )

      return apiSuccess({
        total: reorderSuggestions.length,
        totalEstimatedCost: reorderSuggestions.reduce((s, r) => s + r.estimatedCost, 0),
        items: reorderSuggestions.sort((a, b) => a.currentStock - b.currentStock),
      })
    }

    // ==========================================
    // 库龄分析
    // ==========================================
    if (type === "stock_age") {
      // 查找每个有库存商品的最早入库时间
      const products = await prisma.product.findMany({
        where: { tenantId: tid, isActive: true, stock: { gt: 0 } },
        select: { id: true, name: true, unit: true, stock: true, costPrice: true, category: { select: { name: true } } },
      })

      const now = Date.now()
      const ageAnalysis = await Promise.all(
        products.map(async (p) => {
          // 找最早的入库流水
          const earliestIn = await prisma.stockMovement.findFirst({
            where: { tenantId: tid, productId: p.id, quantity: { gt: 0 } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })

          const firstInDate = earliestIn?.createdAt || new Date()
          const ageDays = Math.floor((now - firstInDate.getTime()) / 86400000)
          const inventoryValue = p.stock * Number(p.costPrice)

          return {
            product: { id: p.id, name: p.name, unit: p.unit, category: p.category?.name },
            stock: p.stock,
            inventoryValue,
            firstInDate: firstInDate.toISOString(),
            ageDays,
            ageGroup: ageDays <= 30 ? "0-30天" : ageDays <= 60 ? "31-60天" : ageDays <= 90 ? "61-90天" : "90天以上",
          }
        })
      )

      // 按库龄分组统计
      const ageGroups: Record<string, { count: number; value: number; items: number }> = {
        "0-30天": { count: 0, value: 0, items: 0 },
        "31-60天": { count: 0, value: 0, items: 0 },
        "61-90天": { count: 0, value: 0, items: 0 },
        "90天以上": { count: 0, value: 0, items: 0 },
      }

      for (const item of ageAnalysis) {
        const g = ageGroups[item.ageGroup]
        g.count++
        g.value += item.inventoryValue
        g.items += item.stock
      }

      return apiSuccess({
        summary: Object.entries(ageGroups).map(([group, data]) => ({ group, ...data })),
        items: ageAnalysis.sort((a, b) => b.ageDays - a.ageDays),
      })
    }

    // ==========================================
    // ABC 分类
    // ==========================================
    if (type === "abc") {
      const days = parseInt(url.searchParams.get("days") ?? "90")
      const since = new Date(Date.now() - days * 86400000)

      // 按商品汇总销售金额
      const saleItems = await prisma.saleOrderItem.findMany({
        where: {
          saleOrder: { tenantId: tid, status: "completed", orderDate: { gte: since } },
        },
        select: { productId: true, subtotal: true, quantity: true },
      })

      const productSales = new Map<string, { revenue: number; qty: number }>()
      for (const item of saleItems) {
        const existing = productSales.get(item.productId) ?? { revenue: 0, qty: 0 }
        productSales.set(item.productId, {
          revenue: existing.revenue + Number(item.subtotal),
          qty: existing.qty + item.quantity,
        })
      }

      // 获取商品信息
      const products = await prisma.product.findMany({
        where: { tenantId: tid, isActive: true },
        select: { id: true, name: true, unit: true, stock: true, costPrice: true, category: { select: { name: true } } },
      })

      const ranked = products
        .map((p) => ({
          product: { id: p.id, name: p.name, unit: p.unit, category: p.category?.name },
          revenue: productSales.get(p.id)?.revenue ?? 0,
          quantity: productSales.get(p.id)?.qty ?? 0,
          stock: p.stock,
          inventoryValue: p.stock * Number(p.costPrice),
        }))
        .sort((a, b) => b.revenue - a.revenue)

      const totalRevenue = ranked.reduce((s, r) => s + r.revenue, 0)

      // ABC classification: A=top 80% revenue, B=next 15%, C=remaining 5%
      let cumulative = 0
      const classified = ranked.map((item) => {
        cumulative += item.revenue
        const pct = totalRevenue > 0 ? cumulative / totalRevenue : 1
        const grade = pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C"
        return { ...item, grade, cumulativePct: Math.round(pct * 100) }
      })

      const summary = {
        A: { count: classified.filter((c) => c.grade === "A").length, revenue: classified.filter((c) => c.grade === "A").reduce((s, c) => s + c.revenue, 0) },
        B: { count: classified.filter((c) => c.grade === "B").length, revenue: classified.filter((c) => c.grade === "B").reduce((s, c) => s + c.revenue, 0) },
        C: { count: classified.filter((c) => c.grade === "C").length, revenue: classified.filter((c) => c.grade === "C").reduce((s, c) => s + c.revenue, 0) },
      }

      return apiSuccess({ days, totalRevenue, summary, items: classified })
    }

    return apiError("未知分析类型")
  } catch (error) {
    console.error("获取仓库分析失败:", error)
    return apiError("获取仓库分析失败", 500)
  }
}
