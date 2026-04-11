import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

interface AgeBucket {
  label: string
  range: string
  batchCount: number
  totalQty: number
  totalValue: number
}

interface BatchDetail {
  id: string
  productName: string
  batchNo: string
  createdAt: string
  daysStored: number
  remainingQty: number
  costPrice: number
  stockValue: number
  expiryDate: string | null
  expiryStatus: "normal" | "expiring_soon" | "expired"
}

interface StockAgeData {
  buckets: AgeBucket[]
  details: BatchDetail[]
}

function getAgeBucket(days: number): number {
  if (days <= 30) return 0
  if (days <= 60) return 1
  if (days <= 90) return 2
  if (days <= 180) return 3
  return 4
}

const BUCKET_CONFIGS = [
  { label: "0-30天", range: "0-30" },
  { label: "31-60天", range: "31-60" },
  { label: "61-90天", range: "61-90" },
  { label: "91-180天", range: "91-180" },
  { label: "180天以上", range: "180+" },
]

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const productId = url.searchParams.get("productId")

  try {
    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
      remainingQty: { gt: 0 },
    }
    if (productId) {
      where.productId = productId
    }

    const batches = await prisma.batch.findMany({
      where,
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    })

    const now = new Date()

    // 初始化分组
    const buckets: AgeBucket[] = BUCKET_CONFIGS.map((c) => ({
      label: c.label,
      range: c.range,
      batchCount: 0,
      totalQty: 0,
      totalValue: 0,
    }))

    const details: BatchDetail[] = batches.map((batch) => {
      const daysStored = Math.floor(
        (now.getTime() - new Date(batch.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      const costPrice = Number(batch.costPrice)
      const stockValue = batch.remainingQty * costPrice
      const bucketIdx = getAgeBucket(daysStored)

      buckets[bucketIdx].batchCount += 1
      buckets[bucketIdx].totalQty += batch.remainingQty
      buckets[bucketIdx].totalValue += stockValue

      let expiryStatus: BatchDetail["expiryStatus"] = "normal"
      if (batch.expiryDate) {
        const daysToExpiry = Math.floor(
          (new Date(batch.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysToExpiry < 0) expiryStatus = "expired"
        else if (daysToExpiry <= 30) expiryStatus = "expiring_soon"
      }

      return {
        id: batch.id,
        productName: batch.product.name,
        batchNo: batch.batchNo,
        createdAt: new Date(batch.createdAt).toISOString().slice(0, 10),
        daysStored,
        remainingQty: batch.remainingQty,
        costPrice,
        stockValue,
        expiryDate: batch.expiryDate
          ? new Date(batch.expiryDate).toISOString().slice(0, 10)
          : null,
        expiryStatus,
      }
    })

    // 按存放天数降序排列
    details.sort((a, b) => b.daysStored - a.daysStored)

    return apiSuccess<StockAgeData>({ buckets, details })
  } catch (error) {
    console.error("库龄分析查询失败:", error)
    return apiError("库龄分析查询失败", 500)
  }
}
