"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, TrendingUp, DollarSign, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"

// ==========================================
// 类型定义
// ==========================================

interface TrendPoint {
  period: string
  avgCostPrice: number
  stockValueAfter: number
  inQty: number
  outQty: number
}

interface CostTrendData {
  periodStart: string
  periodEnd: string
  granularity: string
  productId: string | null
  points: TrendPoint[]
}

interface ProductOption {
  id: string
  name: string
}

// ==========================================
// 纯 CSS 柱状图：成本价趋势
// ==========================================

function CostPriceBarChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return null

  const values = data.map((d) => d.avgCostPrice)
  const maxVal = Math.max(...values, 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">成本价趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-40">
          {data.map((d, i) => {
            const height = maxVal > 0 ? (d.avgCostPrice / maxVal) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                <span className="text-[10px] text-muted-foreground mb-0.5 truncate w-full text-center">
                  ¥{d.avgCostPrice.toFixed(2)}
                </span>
                <div
                  className="w-full rounded-t transition-all duration-300"
                  style={{
                    height: `${height}%`,
                    backgroundColor: "#3b82f6",
                    minHeight: d.avgCostPrice > 0 ? 2 : 0,
                    maxWidth: 32,
                    margin: "0 auto",
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {data.map((d, i) => (
            <div key={i} className="flex-1 min-w-0 text-center">
              <span className="text-[9px] text-muted-foreground truncate block">
                {d.period.slice(-5)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ==========================================
// 纯 CSS 柱状图：进出货量对比
// ==========================================

function InOutBarChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return null

  const allValues = data.flatMap((d) => [d.inQty, d.outQty])
  const maxVal = Math.max(...allValues, 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">进出货量对比</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-40">
          {data.map((d, i) => {
            const inH = maxVal > 0 ? (d.inQty / maxVal) * 100 : 0
            const outH = maxVal > 0 ? (d.outQty / maxVal) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                <div className="flex gap-0.5 w-full justify-center items-end h-full">
                  <div
                    className="rounded-t transition-all duration-300"
                    style={{
                      height: `${inH}%`,
                      backgroundColor: "#3b82f6",
                      minHeight: d.inQty > 0 ? 2 : 0,
                      width: "40%",
                      maxWidth: 14,
                    }}
                  />
                  <div
                    className="rounded-t transition-all duration-300"
                    style={{
                      height: `${outH}%`,
                      backgroundColor: "#ef4444",
                      minHeight: d.outQty > 0 ? 2 : 0,
                      width: "40%",
                      maxWidth: 14,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {data.map((d, i) => (
            <div key={i} className="flex-1 min-w-0 text-center">
              <span className="text-[9px] text-muted-foreground truncate block">
                {d.period.slice(-5)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 justify-center text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> 进货量
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> 出货量
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ==========================================
// CSV+BOM 导出
// ==========================================

function exportCSV(points: TrendPoint[], granularity: string, productId: string | null) {
  const BOM = "\uFEFF"
  const header = ["时间", "平均成本价", "库存金额", "进货量", "出货量", "净变动"]
  const rows = points.map((p) => [
    p.period,
    p.avgCostPrice.toFixed(2),
    p.stockValueAfter.toFixed(2),
    String(p.inQty),
    String(p.outQty),
    String(p.inQty - p.outQty),
  ])
  const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n")
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `成本趋势_${granularity}${productId ? `_${productId.slice(-6)}` : ""}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ==========================================
// 页面组件
// ==========================================

export default function CostTrendPage() {
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>("all")
  const [granularity, setGranularity] = useState<string>("day")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [data, setData] = useState<CostTrendData | null>(null)
  const [loading, setLoading] = useState(false)

  // 初始化日期：本月
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
    setStartDate(`${y}-${m}-01`)
    setEndDate(`${y}-${m}-${lastDay}`)
  }, [])

  // 加载商品列表
  useEffect(() => {
    void (async () => {
      const res = await api<ProductOption[]>("/api/products?pageSize=999")
      if (res.success && res.data) {
        setProducts(res.data)
      }
    })()
  }, [])

  const fetchTrend = useCallback(async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    const params = new URLSearchParams({
      startDate,
      endDate,
      granularity,
    })
    if (selectedProduct !== "all") {
      params.set("productId", selectedProduct)
    }
    const res = await api<CostTrendData>(`/api/reports/cost-trend?${params}`)
    if (res.success && res.data) {
      setData(res.data)
    } else {
      toast.error(res.error ?? "获取数据失败")
    }
    setLoading(false)
  }, [startDate, endDate, granularity, selectedProduct])

  useEffect(() => {
    if (startDate && endDate) {
      void fetchTrend()
    }
  }, [startDate, endDate, granularity, selectedProduct, fetchTrend])

  const points = data?.points ?? []

  return (
    <div className="space-y-4">
      {/* 标题 + 导出 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">成本趋势分析</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(points, granularity, data?.productId ?? null)}
          disabled={points.length === 0}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          导出 Excel
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 商品选择 */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">商品</label>
              <Select value={selectedProduct} onValueChange={(v) => v && setSelectedProduct(v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部商品</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 粒度选择 */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">粒度</label>
              <Select value={granularity} onValueChange={(v) => v && setGranularity(v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">按日</SelectItem>
                  <SelectItem value="week">按周</SelectItem>
                  <SelectItem value="month">按月</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 日期范围 */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">开始日期</label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">结束日期</label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据内容 */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : points.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">该时间段内无数据</p>
      ) : (
        <>
          {/* 汇总卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">平均成本价</p>
                <p className="text-xl font-bold">
                  ¥{points.length > 0
                    ? (points.reduce((s, p) => s + p.avgCostPrice, 0) / points.length).toFixed(2)
                    : "0.00"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">最新库存金额</p>
                <p className="text-xl font-bold text-blue-600">
                  ¥{points.length > 0 ? points[points.length - 1].stockValueAfter.toFixed(2) : "0.00"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <ArrowUpDown className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">总进货量</p>
                <p className="text-xl font-bold text-blue-600">
                  {points.reduce((s, p) => s + p.inQty, 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <ArrowUpDown className="h-4 w-4 mx-auto text-muted-foreground mb-1 rotate-180" />
                <p className="text-xs text-muted-foreground">总出货量</p>
                <p className="text-xl font-bold text-red-600">
                  {points.reduce((s, p) => s + p.outQty, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 图表区域 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CostPriceBarChart data={points} />
            <InOutBarChart data={points} />
          </div>

          {/* 数据表格 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">详细数据</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead className="text-right">平均成本价</TableHead>
                      <TableHead className="text-right">库存金额</TableHead>
                      <TableHead className="text-right">进货量</TableHead>
                      <TableHead className="text-right">出货量</TableHead>
                      <TableHead className="text-right">净变动</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {points.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{p.period}</TableCell>
                        <TableCell className="text-right font-mono">¥{p.avgCostPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-blue-600">¥{p.stockValueAfter.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-blue-600">+{p.inQty}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">-{p.outQty}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {p.inQty - p.outQty > 0 ? "+" : ""}
                          {p.inQty - p.outQty}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端列表 */}
              <div className="md:hidden divide-y">
                {points.map((p, i) => (
                  <div key={i} className="px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{p.period}</span>
                      <span className="font-mono text-sm text-blue-600">¥{p.stockValueAfter.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>成本价 ¥{p.avgCostPrice.toFixed(2)}</span>
                      <span>
                        <span className="text-blue-600">+{p.inQty}</span>
                        {" / "}
                        <span className="text-red-600">-{p.outQty}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
