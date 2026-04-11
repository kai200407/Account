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
  const startDateStr = url.searchParams.get("startDate")
  const endDateStr = url.searchParams.get("endDate")

  // 默认最近30天
  const now = new Date()
  const defaultEnd = formatCNDate(now)
  const defaultStart = formatCNDate(new Date(now.getTime() - 30 * 86400000))

  const startDate = startDateStr ? parseCNDateRange(startDateStr) : parseCNDateRange(defaultStart)
  const endDate = endDateStr ? parseCNDateRange(endDateStr, true) : parseCNDateRange(defaultEnd, true)

  // 期初日期（startDate 前一天的 23:59:59）
  const beforeStart = new Date(startDate.getTime() - 1)

  try {
    // ==========================================
    // 1. 销售成本 = 期间内 SaleOrderItem 的 sum(costPrice * quantity)
    // ==========================================
    const saleItems = await prisma.saleOrderItem.findMany({
      where: {
        saleOrder: {
          tenantId: auth.tenantId,
          status: "completed",
          orderDate: { gte: startDate, lte: endDate },
        },
      },
      select: {
        costPrice: true,
        quantity: true,
        productId: true,
        product: {
          select: {
            name: true,
            categoryId: true,
            category: { select: { name: true } },
          },
        },
      },
    })

    // 按商品汇总销售成本
    const cogsByProduct = new Map<string, { cogs: number; name: string; categoryId: string | null; categoryName: string }>()
    let totalCOGS = 0
    for (const item of saleItems) {
      const cogs = Number(item.costPrice) * item.quantity
      totalCOGS += cogs
      const existing = cogsByProduct.get(item.productId)
      if (existing) {
        existing.cogs += cogs
      } else {
        cogsByProduct.set(item.productId, {
          cogs,
          name: item.product.name,
          categoryId: item.product.categoryId,
          categoryName: item.product.category?.name ?? "未分类",
        })
      }
    }

    // ==========================================
    // 2. 期初库存金额 & 期末库存金额
    //    使用 StockMovement 的 stockValueAfter 追踪
    //    期初 = 期间开始前最后一次变动的 stockValueAfter
    //    期末 = 期间内最后一次变动的 stockValueAfter（或当前 Product.stockValue）
    // ==========================================
    const allProductIds = new Set<string>()
    for (const id of cogsByProduct.keys()) allProductIds.add(id)

    // 获取所有在售商品（有库存的也纳入计算）
    const activeProducts = await prisma.product.findMany({
      where: { tenantId: auth.tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        stock: true,
        costPrice: true,
        stockValue: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    })

    for (const p of activeProducts) {
      allProductIds.add(p.id)
    }

    // 获取期初库存（startDate 之前最后一次库存变动）
    const beforeMovements = await prisma.stockMovement.findMany({
      where: {
        tenantId: auth.tenantId,
        productId: { in: [...allProductIds] },
        createdAt: { lt: startDate },
        stockValueAfter: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { productId: true, stockValueAfter: true, createdAt: true },
    })

    // 获取期末库存（期间内最后一次库存变动）
    const endMovements = await prisma.stockMovement.findMany({
      where: {
        tenantId: auth.tenantId,
        productId: { in: [...allProductIds] },
        createdAt: { lte: endDate },
        stockValueAfter: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { productId: true, stockValueAfter: true, createdAt: true },
    })

    // 构建期初/期末库存金额 Map（取每个商品最新的变动记录）
    const startInventoryMap = new Map<string, number>()
    for (const m of beforeMovements) {
      if (!startInventoryMap.has(m.productId)) {
        startInventoryMap.set(m.productId, Number(m.stockValueAfter))
      }
    }

    const endInventoryMap = new Map<string, number>()
    for (const m of endMovements) {
      if (!endInventoryMap.has(m.productId)) {
        endInventoryMap.set(m.productId, Number(m.stockValueAfter))
      }
    }

    // 对没有库存变动记录的商品，使用当前 Product.stockValue 作为期初和期末
    const productMap = new Map(activeProducts.map((p) => [p.id, p]))
    for (const id of allProductIds) {
      const product = productMap.get(id)
      if (!product) continue

      if (!startInventoryMap.has(id)) {
        // 没有期初记录，说明在 startDate 之前没有库存变动
        // 如果也没有期初前的变动，则期初库存为 0 或使用当前值
        startInventoryMap.set(id, 0)
      }

      if (!endInventoryMap.has(id)) {
        // 没有期末记录，使用当前商品库存金额
        endInventoryMap.set(id, Number(product.stockValue))
      }
    }

    // ==========================================
    // 3. 按商品维度汇总
    // ==========================================
    const productTurnover = []
    for (const id of allProductIds) {
      const product = productMap.get(id)
      const cogsInfo = cogsByProduct.get(id)
      const startInv = startInventoryMap.get(id) ?? 0
      const endInv = endInventoryMap.get(id) ?? 0
      const avgInv = (startInv + endInv) / 2
      const cogs = cogsInfo?.cogs ?? 0
      const turnoverRate = avgInv > 0 ? cogs / avgInv : 0

      // 只有有销售或有库存的商品才展示
      if (cogs === 0 && avgInv === 0) continue

      productTurnover.push({
        productId: id,
        name: cogsInfo?.name ?? product?.name ?? "未知商品",
        categoryName: cogsInfo?.categoryName ?? product?.category?.name ?? "未分类",
        cogs: Math.round(cogs * 100) / 100,
        startInventory: Math.round(startInv * 100) / 100,
        endInventory: Math.round(endInv * 100) / 100,
        avgInventory: Math.round(avgInv * 100) / 100,
        turnoverRate: Math.round(turnoverRate * 100) / 100,
      })
    }

    productTurnover.sort((a, b) => b.turnoverRate - a.turnoverRate)

    // ==========================================
    // 4. 按分类维度汇总
    // ==========================================
    const categoryMap = new Map<string, { categoryName: string; cogs: number; startInv: number; endInv: number }>()
    for (const item of productTurnover) {
      const cat = item.categoryName
      const existing = categoryMap.get(cat)
      if (existing) {
        existing.cogs += item.cogs
        existing.startInv += item.startInventory
        existing.endInv += item.endInventory
      } else {
        categoryMap.set(cat, {
          categoryName: cat,
          cogs: item.cogs,
          startInv: item.startInventory,
          endInv: item.endInventory,
        })
      }
    }

    const categoryTurnover = Array.from(categoryMap.values()).map((cat) => {
      const avgInv = (cat.startInv + cat.endInv) / 2
      const turnoverRate = avgInv > 0 ? cat.cogs / avgInv : 0
      return {
        categoryName: cat.categoryName,
        cogs: Math.round(cat.cogs * 100) / 100,
        avgInventory: Math.round(avgInv * 100) / 100,
        turnoverRate: Math.round(turnoverRate * 100) / 100,
      }
    }).sort((a, b) => b.turnoverRate - a.turnoverRate)

    // ==========================================
    // 5. 汇总
    // ==========================================
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000))
    const totalStartInv = productTurnover.reduce((s, p) => s + p.startInventory, 0)
    const totalEndInv = productTurnover.reduce((s, p) => s + p.endInventory, 0)
    const totalAvgInv = (totalStartInv + totalEndInv) / 2
    const overallTurnoverRate = totalAvgInv > 0 ? totalCOGS / totalAvgInv : 0
    const daysOfInventory = overallTurnoverRate > 0 ? Math.round(daysDiff / overallTurnoverRate) : 0

    return apiSuccess({
      summary: {
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        totalAvgInventory: Math.round(totalAvgInv * 100) / 100,
        totalStartInventory: Math.round(totalStartInv * 100) / 100,
        totalEndInventory: Math.round(totalEndInv * 100) / 100,
        turnoverRate: Math.round(overallTurnoverRate * 100) / 100,
        daysOfInventory,
        daysPeriod: daysDiff,
      },
      byProduct: productTurnover,
      byCategory: categoryTurnover,
    })
  } catch (error) {
    console.error("库存周转率计算失败:", error)
    return apiError("库存周转率计算失败", 500)
  }
}
