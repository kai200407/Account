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

type Granularity = "day" | "week" | "month"

function getPeriodKey(date: Date, granularity: Granularity): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")

  if (granularity === "day") return `${y}-${m}-${d}`
  if (granularity === "month") return `${y}-${m}`

  // week: use ISO week number
  const jan1 = new Date(y, 0, 1)
  const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${y}-W${String(weekNum).padStart(2, "0")}`
}

function formatPeriodLabel(key: string, granularity: Granularity): string {
  if (granularity === "day") return key
  if (granularity === "month") return key
  // week
  return key
}

interface TrendPoint {
  period: string
  avgCostPrice: number
  stockValueAfter: number
  inQty: number
  outQty: number
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const productId = url.searchParams.get("productId") ?? ""
  const startDate = url.searchParams.get("startDate") ?? ""
  const endDate = url.searchParams.get("endDate") ?? ""
  const granularity = (url.searchParams.get("granularity") ?? "day") as Granularity

  if (!["day", "week", "month"].includes(granularity)) {
    return apiError("granularity 仅支持 day/week/month")
  }

  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const start = startDate ? parseCNDateRange(startDate) : defaultStart
  const end = endDate ? parseCNDateRange(endDate, true) : defaultEnd

  try {
    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
      createdAt: { gte: start, lte: end },
    }
    if (productId) {
      where.productId = productId
    }

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

    // 按时间段聚合
    const periodMap = new Map<string, {
      costPrices: number[]
      stockValues: number[]
      inQty: number
      outQty: number
    }>()

    for (const m of movements) {
      const key = getPeriodKey(m.createdAt, granularity)
      const entry = periodMap.get(key) ?? { costPrices: [], stockValues: [], inQty: 0, outQty: 0 }

      if (m.costPrice !== null) {
        entry.costPrices.push(Number(m.costPrice))
      }
      if (m.stockValueAfter !== null) {
        entry.stockValues.push(Number(m.stockValueAfter))
      }
      if (m.quantity > 0) {
        entry.inQty += m.quantity
      } else {
        entry.outQty += Math.abs(m.quantity)
      }

      periodMap.set(key, entry)
    }

    // 按时间排序
    const sortedKeys = Array.from(periodMap.keys()).sort()

    const points: TrendPoint[] = sortedKeys.map((key) => {
      const data = periodMap.get(key)!
      const avgCostPrice = data.costPrices.length > 0
        ? data.costPrices.reduce((a, b) => a + b, 0) / data.costPrices.length
        : 0
      const stockValueAfter = data.stockValues.length > 0
        ? data.stockValues[data.stockValues.length - 1]
        : 0

      return {
        period: formatPeriodLabel(key, granularity),
        avgCostPrice: Math.round(avgCostPrice * 100) / 100,
        stockValueAfter: Math.round(stockValueAfter * 100) / 100,
        inQty: data.inQty,
        outQty: data.outQty,
      }
    })

    return apiSuccess({
      periodStart: formatCNDate(start),
      periodEnd: formatCNDate(end),
      granularity,
      productId: productId || null,
      points,
    })
  } catch (error) {
    console.error("获取成本趋势失败:", error)
    return apiError("获取成本趋势失败", 500)
  }
}
