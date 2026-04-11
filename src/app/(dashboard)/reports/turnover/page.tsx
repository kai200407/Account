"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, TrendingUp, Clock, DollarSign, Package } from "lucide-react"
import { toast } from "sonner"

// ==========================================
// 类型定义
// ==========================================

interface TurnoverSummary {
  totalCOGS: number
  totalAvgInventory: number
  totalStartInventory: number
  totalEndInventory: number
  turnoverRate: number
  daysOfInventory: number
  daysPeriod: number
}

interface ProductTurnoverItem {
  productId: string
  name: string
  categoryName: string
  cogs: number
  startInventory: number
  endInventory: number
  avgInventory: number
  turnoverRate: number
}

interface CategoryTurnoverItem {
  categoryName: string
  cogs: number
  avgInventory: number
  turnoverRate: number
}

interface TurnoverData {
  summary: TurnoverSummary
  byProduct: ProductTurnoverItem[]
  byCategory: CategoryTurnoverItem[]
}

// ==========================================
// 页面组件
// ==========================================

export default function TurnoverPage() {
  const [data, setData] = useState<TurnoverData | null>(null)
  const [loading, setLoading] = useState(true)

  // 默认最近30天
  const now = new Date()
  const defaultEnd = formatDate(now)
  const defaultStart = formatDate(new Date(now.getTime() - 30 * 86400000))

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)

  function formatDate(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const fetchData = useCallback(async (start: string, end: string) => {
    setLoading(true)
    const res = await api<TurnoverData>(
      `/api/reports/turnover?startDate=${start}&endDate=${end}`
    )
    if (res.success && res.data) {
      setData(res.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchData(startDate, endDate)
  }, [fetchData, startDate, endDate])

  const handleExport = () => {
    if (!data) return

    const bom = "\uFEFF"
    const header = "商品名,分类,销售成本,期初库存,期末库存,平均库存,周转率,周转天数"
    const rows = data.byProduct.map((item) => {
      const days = item.turnoverRate > 0
        ? Math.round(data.summary.daysPeriod / item.turnoverRate)
        : 0
      return [
        `"${item.name}"`,
        `"${item.categoryName}"`,
        item.cogs.toFixed(2),
        item.startInventory.toFixed(2),
        item.endInventory.toFixed(2),
        item.avgInventory.toFixed(2),
        item.turnoverRate.toFixed(2),
        days,
      ].join(",")
    })

    // 分类汇总
    rows.push("")
    rows.push("=== 分类汇总 ===")
    const catHeader = "分类,销售成本,平均库存,周转率"
    const catRows = data.byCategory.map((item) => [
      `"${item.categoryName}"`,
      item.cogs.toFixed(2),
      item.avgInventory.toFixed(2),
      item.turnoverRate.toFixed(2),
    ].join(","))

    const csv = bom + [header, ...rows, catHeader, ...catRows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `库存周转分析_${startDate}_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("导出成功")
  }

  const getTurnoverColor = (rate: number) => {
    if (rate > 2) return "text-green-600 font-semibold"
    if (rate < 0.5) return "text-red-600 font-semibold"
    return ""
  }

  const getTurnoverBg = (rate: number) => {
    if (rate > 2) return "bg-green-50"
    if (rate < 0.5) return "bg-red-50"
    return ""
  }

  return (
    <div className="space-y-4">
      {/* 标题和操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">库存周转分析</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
            <Download className="h-3.5 w-3.5 mr-1" />
            导出 Excel
          </Button>
        </div>
      </div>

      {/* 日期选择器 */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-9 w-[150px]"
        />
        <span className="text-muted-foreground">至</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : data ? (
        <>
          {/* 汇总卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">总周转率</p>
                </div>
                <p className={`text-xl font-bold ${getTurnoverColor(data.summary.turnoverRate)}`}>
                  {data.summary.turnoverRate.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">平均周转天数</p>
                </div>
                <p className="text-xl font-bold">
                  {data.summary.daysOfInventory > 0 ? `${data.summary.daysOfInventory}天` : "-"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">销售总成本</p>
                </div>
                <p className="text-xl font-bold">
                  ¥{data.summary.totalCOGS.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">平均库存金额</p>
                </div>
                <p className="text-xl font-bold">
                  ¥{data.summary.totalAvgInventory.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 分类汇总 */}
          {data.byCategory.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>分类</TableHead>
                        <TableHead className="text-right">销售成本</TableHead>
                        <TableHead className="text-right">平均库存</TableHead>
                        <TableHead className="text-right">周转率</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byCategory.map((item) => (
                        <TableRow key={item.categoryName}>
                          <TableCell className="font-medium">{item.categoryName}</TableCell>
                          <TableCell className="text-right font-mono">¥{item.cogs.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">¥{item.avgInventory.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-mono ${getTurnoverColor(item.turnoverRate)}`}>
                            {item.turnoverRate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden divide-y">
                  {data.byCategory.map((item) => (
                    <div key={item.categoryName} className="px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.categoryName}</span>
                        <span className={`font-mono text-sm ${getTurnoverColor(item.turnoverRate)}`}>
                          周转率 {item.turnoverRate.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>成本 ¥{item.cogs.toFixed(2)}</span>
                        <span>均库 ¥{item.avgInventory.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 按商品表格 */}
          <Card>
            <CardContent className="p-0">
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品名</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead className="text-right">销售成本</TableHead>
                      <TableHead className="text-right">平均库存</TableHead>
                      <TableHead className="text-right">周转率</TableHead>
                      <TableHead className="text-right">周转天数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byProduct.map((item) => {
                      const days = item.turnoverRate > 0
                        ? Math.round(data.summary.daysPeriod / item.turnoverRate)
                        : 0
                      return (
                        <TableRow key={item.productId} className={getTurnoverBg(item.turnoverRate)}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.categoryName}</TableCell>
                          <TableCell className="text-right font-mono">¥{item.cogs.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">¥{item.avgInventory.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-mono ${getTurnoverColor(item.turnoverRate)}`}>
                            {item.turnoverRate.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {days > 0 ? `${days}天` : "-"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {data.byProduct.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端列表 */}
              <div className="md:hidden divide-y">
                {data.byProduct.map((item) => {
                  const days = item.turnoverRate > 0
                    ? Math.round(data.summary.daysPeriod / item.turnoverRate)
                    : 0
                  return (
                    <div
                      key={item.productId}
                      className={`px-3 py-2 space-y-1 ${getTurnoverBg(item.turnoverRate)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{item.categoryName}</span>
                        </div>
                        <span className={`font-mono text-sm ${getTurnoverColor(item.turnoverRate)}`}>
                          {item.turnoverRate.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>成本 ¥{item.cogs.toFixed(2)} · 均库 ¥{item.avgInventory.toFixed(2)}</span>
                        <span>{days > 0 ? `${days}天` : "-"}</span>
                      </div>
                    </div>
                  )
                })}
                {data.byProduct.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">暂无数据</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
