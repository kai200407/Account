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
  const type = url.searchParams.get("type") ?? "overview"
  const startDate = url.searchParams.get("start") ?? ""
  const endDate = url.searchParams.get("end") ?? ""

  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const start = startDate ? parseCNDateRange(startDate) : defaultStart
  const end = endDate ? parseCNDateRange(endDate, true) : defaultEnd

  try {
    // ==========================================
    // 库存总览：各商品库存量、成本价、库存金额
    // ==========================================
    if (type === "overview") {
      const products = await prisma.product.findMany({
        where: { tenantId: auth.tenantId, isActive: true },
        include: {
          category: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      })

      // 单独查询仓库库存
      const warehouseStocks = await prisma.warehouseStock.findMany({
        where: { tenantId: auth.tenantId, quantity: { gt: 0 } },
        include: { warehouse: { select: { name: true } } },
      })

      // 按商品 ID 索引仓库库存
      const stockByProduct = new Map<string, Array<{ warehouse: string; quantity: number }>>()
      for (const ws of warehouseStocks) {
        const list = stockByProduct.get(ws.productId) ?? []
        list.push({ warehouse: ws.warehouse.name, quantity: ws.quantity })
        stockByProduct.set(ws.productId, list)
      }

      const items = products.map((p) => {
        const costPrice = Number(p.costPrice)
        const stockValue = Number(p.stockValue)
        const warehouseDetails = stockByProduct.get(p.id) ?? []

        return {
          id: p.id,
          name: p.name,
          sku: p.sku ?? "",
          unit: p.unit,
          category: p.category?.name ?? "未分类",
          stock: p.stock,
          costPrice,
          stockValue,
          lowStockAlert: p.lowStockAlert,
          isLowStock: p.stock <= p.lowStockAlert,
          warehouseDetails,
        }
      })

      const totalStock = items.reduce((s, i) => s + i.stock, 0)
      const totalValue = items.reduce((s, i) => s + i.stockValue, 0)
      const lowStockCount = items.filter((i) => i.isLowStock).length

      return apiSuccess({
        totalProducts: items.length,
        totalStock,
        totalValue,
        lowStockCount,
        items,
      })
    }

    // ==========================================
    // 收发存汇总：期初+入库-出库=期末
    // ==========================================
    if (type === "movement") {
      const dateFilter = { gte: start, lte: end }

      // 查询期初之前的所有流水，计算期初库存
      const movementsBefore = await prisma.stockMovement.findMany({
        where: {
          tenantId: auth.tenantId,
          createdAt: { lt: start },
        },
        select: { productId: true, quantity: true, product: { select: { name: true, unit: true } } },
      })

      const openingMap = new Map<string, { name: string; unit: string; openingQty: number }>()
      for (const m of movementsBefore) {
        const existing = openingMap.get(m.productId) ?? {
          name: m.product.name,
          unit: m.product.unit,
          openingQty: 0,
        }
        existing.openingQty += m.quantity
        openingMap.set(m.productId, existing)
      }

      // 查询日期范围内的流水
      const movements = await prisma.stockMovement.findMany({
        where: {
          tenantId: auth.tenantId,
          createdAt: dateFilter,
        },
        select: {
          productId: true,
          quantity: true,
          type: true,
          product: { select: { name: true, unit: true } },
        },
      })

      const resultMap = new Map<string, {
        name: string
        unit: string
        openingQty: number
        inQty: number
        outQty: number
        closingQty: number
      }>()

      // 先把期初数据填入
      for (const [productId, data] of openingMap) {
        resultMap.set(productId, {
          name: data.name,
          unit: data.unit,
          openingQty: data.openingQty,
          inQty: 0,
          outQty: 0,
          closingQty: data.openingQty,
        })
      }

      // 范围内有流水但期初没出现的商品（期初为0）
      const productsInRange = new Set(movements.map((m) => m.productId))
      for (const pid of productsInRange) {
        if (!resultMap.has(pid)) {
          const p = movements.find((m) => m.productId === pid)!.product
          resultMap.set(pid, {
            name: p.name,
            unit: p.unit,
            openingQty: 0,
            inQty: 0,
            outQty: 0,
            closingQty: 0,
          })
        }
      }

      // 累加期间的入库和出库
      for (const m of movements) {
        const row = resultMap.get(m.productId)!
        if (m.quantity > 0) {
          row.inQty += m.quantity
        } else {
          row.outQty += Math.abs(m.quantity)
        }
        row.closingQty = row.openingQty + row.inQty - row.outQty
      }

      const items = Array.from(resultMap.entries())
        .map(([productId, data]) => ({ id: productId, ...data }))
        .sort((a, b) => b.closingQty - a.closingQty)

      const totalOpening = items.reduce((s, i) => s + i.openingQty, 0)
      const totalIn = items.reduce((s, i) => s + i.inQty, 0)
      const totalOut = items.reduce((s, i) => s + i.outQty, 0)
      const totalClosing = items.reduce((s, i) => s + i.closingQty, 0)

      return apiSuccess({
        periodStart: formatCNDate(start),
        periodEnd: formatCNDate(end),
        totalOpening,
        totalIn,
        totalOut,
        totalClosing,
        items,
      })
    }

    // ==========================================
    // 库存金额统计：按分类和仓库维度
    // ==========================================
    if (type === "value") {
      const products = await prisma.product.findMany({
        where: { tenantId: auth.tenantId, isActive: true },
        include: {
          category: { select: { name: true } },
        },
      })

      // 单独查询仓库库存
      const warehouseStocks = await prisma.warehouseStock.findMany({
        where: { tenantId: auth.tenantId, quantity: { gt: 0 } },
        include: { warehouse: { select: { id: true, name: true } } },
      })

      // 按商品 ID 建立成本价索引
      const costPriceMap = new Map(products.map((p) => [p.id, Number(p.costPrice)]))

      const totalValue = products.reduce((s, p) => s + Number(p.stockValue), 0)
      const totalCost = products.reduce((s, p) => s + Number(p.costPrice) * p.stock, 0)
      const totalStock = products.reduce((s, p) => s + p.stock, 0)

      // 按分类汇总
      const categoryMap = new Map<string, { name: string; stockValue: number; stockQty: number; productCount: number }>()
      for (const p of products) {
        const catName = p.category?.name ?? "未分类"
        const catId = p.categoryId ?? "none"
        const existing = categoryMap.get(catId) ?? { name: catName, stockValue: 0, stockQty: 0, productCount: 0 }
        categoryMap.set(catId, {
          name: catName,
          stockValue: existing.stockValue + Number(p.stockValue),
          stockQty: existing.stockQty + p.stock,
          productCount: existing.productCount + 1,
        })
      }

      const byCategory = Array.from(categoryMap.values())
        .sort((a, b) => b.stockValue - a.stockValue)

      // 按仓库汇总
      const warehouseMap = new Map<string, { id: string; name: string; stockQty: number; stockValue: number }>()
      for (const ws of warehouseStocks) {
        const costPrice = costPriceMap.get(ws.productId) ?? 0
        const valueInWarehouse = ws.quantity * costPrice
        const wid = ws.warehouse.id
        const existing = warehouseMap.get(wid) ?? { id: wid, name: ws.warehouse.name, stockQty: 0, stockValue: 0 }
        warehouseMap.set(wid, {
          id: wid,
          name: ws.warehouse.name,
          stockQty: existing.stockQty + ws.quantity,
          stockValue: existing.stockValue + valueInWarehouse,
        })
      }

      const byWarehouse = Array.from(warehouseMap.values())
        .sort((a, b) => b.stockValue - a.stockValue)

      return apiSuccess({
        totalValue,
        totalCost,
        totalStock,
        totalProducts: products.length,
        byCategory,
        byWarehouse,
      })
    }

    return apiError("未知报表类型，支持: overview / movement / value")
  } catch (error) {
    console.error("获取库存报表失败:", error)
    return apiError("获取库存报表失败", 500)
  }
}
