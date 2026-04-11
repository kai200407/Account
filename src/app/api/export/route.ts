import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiError } from "@/lib/api-response"
import * as XLSX from "xlsx"

const CN_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" })

function formatCNDate(date: Date) {
  return CN_DATE_FORMATTER.format(date)
}

function parseCNDateRange(dateStr: string, end = false) {
  return new Date(`${dateStr}T${end ? "23:59:59" : "00:00:00"}+08:00`)
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const type = url.searchParams.get("type") ?? ""
  const startDate = url.searchParams.get("start") ?? ""
  const endDate = url.searchParams.get("end") ?? ""

  const now = new Date()
  const start = startDate ? parseCNDateRange(startDate) : new Date(now.getFullYear(), now.getMonth(), 1)
  const end = endDate ? parseCNDateRange(endDate, true) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const dateFilter = { gte: start, lte: end }

  try {
    const wb = XLSX.utils.book_new()

    if (type === "sales") {
      const sales = await prisma.saleOrder.findMany({
        where: { tenantId: auth.tenantId, status: "completed", orderDate: dateFilter },
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { orderDate: "desc" },
      })

      const rows = sales.flatMap((order) =>
        order.items.map((item) => ({
          "单号": order.orderNo,
          "日期": formatCNDate(order.orderDate),
          "客户": order.customer?.name ?? "散客",
          "类型": order.saleType === "wholesale" ? "批发" : "零售",
          "商品": item.product.name,
          "数量": item.quantity,
          "单位": item.product.unit,
          "单价": Number(item.unitPrice),
          "小计": Number(item.subtotal),
          "成本": Number(item.costPrice) * item.quantity,
          "利润": Number(item.profit),
          "总金额": Number(order.totalAmount),
          "已收": Number(order.paidAmount),
        }))
      )

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "销售记录")
    } else if (type === "purchases") {
      const purchases = await prisma.purchaseOrder.findMany({
        where: { tenantId: auth.tenantId, status: "completed", orderDate: dateFilter },
        include: { supplier: true, items: { include: { product: true } } },
        orderBy: { orderDate: "desc" },
      })

      const rows = purchases.flatMap((order) =>
        order.items.map((item) => ({
          "单号": order.orderNo,
          "日期": formatCNDate(order.orderDate),
          "供应商": order.supplier.name,
          "商品": item.product.name,
          "数量": item.quantity,
          "单位": item.product.unit,
          "单价": Number(item.unitPrice),
          "小计": Number(item.subtotal),
          "总金额": Number(order.totalAmount),
          "已付": Number(order.paidAmount),
        }))
      )

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "进货记录")
    } else if (type === "receivable") {
      const customers = await prisma.customer.findMany({
        where: { tenantId: auth.tenantId, isActive: true, balance: { gt: 0 } },
        orderBy: { balance: "desc" },
      })

      const rows = customers.map((c) => ({
        "客户名": c.name,
        "类型": c.customerType === "wholesale" ? "批发" : "零售",
        "电话": c.phone ?? "",
        "欠款金额": Number(c.balance),
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "应收款明细")
    } else if (type === "payable") {
      const suppliers = await prisma.supplier.findMany({
        where: { tenantId: auth.tenantId, isActive: true, balance: { gt: 0 } },
        orderBy: { balance: "desc" },
      })

      const rows = suppliers.map((s) => ({
        "供应商": s.name,
        "联系人": s.contact ?? "",
        "电话": s.phone ?? "",
        "欠款金额": Number(s.balance),
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "应付款明细")
    } else if (type === "inventory") {
      const subtype = url.searchParams.get("subtype") ?? "overview"

      if (subtype === "overview") {
        const products = await prisma.product.findMany({
          where: { tenantId: auth.tenantId, isActive: true },
          include: { category: { select: { name: true } } },
          orderBy: { name: "asc" },
        })

        const rows = products.map((p) => ({
          "商品": p.name,
          "SKU": p.sku ?? "",
          "分类": p.category?.name ?? "未分类",
          "单位": p.unit,
          "库存量": p.stock,
          "成本价": Number(p.costPrice),
          "库存金额": Number(p.stockValue),
          "预警线": p.lowStockAlert,
          "状态": p.stock <= p.lowStockAlert ? "低库存" : "正常",
        }))

        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, "库存总览")
      } else if (subtype === "movement") {
        const movementsBefore = await prisma.stockMovement.findMany({
          where: { tenantId: auth.tenantId, createdAt: { lt: start } },
          select: { productId: true, quantity: true, product: { select: { name: true, unit: true } } },
        })

        const openingMap = new Map<string, { name: string; unit: string; qty: number }>()
        for (const m of movementsBefore) {
          const e = openingMap.get(m.productId) ?? { name: m.product.name, unit: m.product.unit, qty: 0 }
          e.qty += m.quantity
          openingMap.set(m.productId, e)
        }

        const movements = await prisma.stockMovement.findMany({
          where: { tenantId: auth.tenantId, createdAt: dateFilter },
          select: { productId: true, quantity: true, product: { select: { name: true, unit: true } } },
        })

        const resultMap = new Map<string, { name: string; unit: string; opening: number; inQty: number; outQty: number }>()
        for (const [pid, d] of openingMap) {
          resultMap.set(pid, { name: d.name, unit: d.unit, opening: d.qty, inQty: 0, outQty: 0 })
        }
        for (const m of movements) {
          if (!resultMap.has(m.productId)) {
            resultMap.set(m.productId, { name: m.product.name, unit: m.product.unit, opening: 0, inQty: 0, outQty: 0 })
          }
          const row = resultMap.get(m.productId)!
          if (m.quantity > 0) row.inQty += m.quantity
          else row.outQty += Math.abs(m.quantity)
        }

        const rows = Array.from(resultMap.entries()).map(([_, d]) => ({
          "商品": d.name,
          "单位": d.unit,
          "期初": d.opening,
          "入库": d.inQty,
          "出库": d.outQty,
          "期末": d.opening + d.inQty - d.outQty,
        }))

        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, "收发存汇总")
      } else if (subtype === "value") {
        const products = await prisma.product.findMany({
          where: { tenantId: auth.tenantId, isActive: true },
          include: { category: { select: { name: true } } },
        })

        const categoryMap = new Map<string, { name: string; stockValue: number; stockQty: number; count: number }>()
        for (const p of products) {
          const catName = p.category?.name ?? "未分类"
          const catId = p.categoryId ?? "none"
          const e = categoryMap.get(catId) ?? { name: catName, stockValue: 0, stockQty: 0, count: 0 }
          categoryMap.set(catId, {
            name: catName,
            stockValue: e.stockValue + Number(p.stockValue),
            stockQty: e.stockQty + p.stock,
            count: e.count + 1,
          })
        }

        const rows = Array.from(categoryMap.values()).map((c) => ({
          "分类": c.name,
          "商品数": c.count,
          "库存量": c.stockQty,
          "库存金额": c.stockValue,
        }))

        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, "库存金额")
      } else {
        return apiError("未知库存报表类型，支持: overview/movement/value")
      }
    } else if (type === "stock-age") {
      const productId = url.searchParams.get("productId") ?? ""

      const where: { tenantId: string; remainingQty: { gt: number }; productId?: string } = {
        tenantId: auth.tenantId,
        remainingQty: { gt: 0 },
      }
      if (productId) where.productId = productId

      const batches = await prisma.batch.findMany({
        where,
        include: { product: { select: { name: true, unit: true } } },
        orderBy: { createdAt: "asc" },
      })

      const batchNow = new Date()
      const rows = batches.map((b) => {
        const days = Math.floor((batchNow.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        let expiryLabel = "无保质期"
        if (b.expiryDate) {
          const diffDays = Math.ceil((new Date(b.expiryDate).getTime() - batchNow.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < 0) expiryLabel = "已过期"
          else if (diffDays <= 30) expiryLabel = "即将过期"
          else expiryLabel = "正常"
        }
        let ageBucket = ""
        if (days <= 30) ageBucket = "0-30天"
        else if (days <= 60) ageBucket = "31-60天"
        else if (days <= 90) ageBucket = "61-90天"
        else if (days <= 180) ageBucket = "91-180天"
        else ageBucket = "180天以上"
        return {
          "商品": b.product.name,
          "批次号": b.batchNo,
          "入库日期": formatCNDate(new Date(b.createdAt)),
          "存放天数": days,
          "库龄区间": ageBucket,
          "剩余数量": b.remainingQty,
          "单位": b.product.unit,
          "成本价": Number(b.costPrice),
          "金额": b.remainingQty * Number(b.costPrice),
          "过期日期": b.expiryDate ? formatCNDate(new Date(b.expiryDate)) : "-",
          "保质期状态": expiryLabel,
        }
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "库龄分析")
    } else if (type === "cost-trend") {
      const productId = url.searchParams.get("productId") ?? ""
      const granularity = url.searchParams.get("granularity") ?? "day"

      const where: Record<string, unknown> = {
        tenantId: auth.tenantId,
        createdAt: { gte: start, lte: end },
      }
      if (productId) where.productId = productId

      const movements = await prisma.stockMovement.findMany({
        where,
        select: {
          createdAt: true,
          quantity: true,
          costPrice: true,
          stockValueAfter: true,
          type: true,
        },
        orderBy: { createdAt: "asc" },
      })

      type Granularity = "day" | "week" | "month"
      const gran = granularity as Granularity

      function getPeriodKey(date: Date, g: Granularity): string {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, "0")
        const d = String(date.getDate()).padStart(2, "0")
        if (g === "day") return `${y}-${m}-${d}`
        if (g === "month") return `${y}-${m}`
        const jan1 = new Date(y, 0, 1)
        const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
        return `${y}-W${String(weekNum).padStart(2, "0")}`
      }

      const periodMap = new Map<string, { costPrices: number[]; stockValues: number[]; inQty: number; outQty: number }>()
      for (const m of movements) {
        const key = getPeriodKey(m.createdAt, gran)
        const entry = periodMap.get(key) ?? { costPrices: [], stockValues: [], inQty: 0, outQty: 0 }
        if (m.costPrice !== null) entry.costPrices.push(Number(m.costPrice))
        if (m.stockValueAfter !== null) entry.stockValues.push(Number(m.stockValueAfter))
        if (m.quantity > 0) entry.inQty += m.quantity
        else entry.outQty += Math.abs(m.quantity)
        periodMap.set(key, entry)
      }

      const sortedKeys = Array.from(periodMap.keys()).sort()
      const rows = sortedKeys.map((key) => {
        const d = periodMap.get(key)!
        const avgCostPrice = d.costPrices.length > 0 ? d.costPrices.reduce((a, b) => a + b, 0) / d.costPrices.length : 0
        const stockValueAfter = d.stockValues.length > 0 ? d.stockValues[d.stockValues.length - 1] : 0
        return {
          "时间": key,
          "平均成本价": Math.round(avgCostPrice * 100) / 100,
          "库存金额": Math.round(stockValueAfter * 100) / 100,
          "进货量": d.inQty,
          "出货量": d.outQty,
          "净变动": d.inQty - d.outQty,
        }
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "成本趋势")
    } else {
      return apiError("请指定导出类型: sales/purchases/receivable/payable/inventory/stock-age/cost-trend")
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const filename = `${type}_${formatCNDate(start)}_${formatCNDate(end)}.xlsx`

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("导出失败:", error)
    return apiError("导出失败", 500)
  }
}
