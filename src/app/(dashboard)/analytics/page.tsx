"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ShoppingCart, Clock, BarChart3, AlertTriangle } from "lucide-react"

// ==========================================
// Types
// ==========================================

interface ReorderItem {
  product: { id: string; name: string; unit: string; category: string | null }
  currentStock: number
  lowStockAlert: number
  suggestedQty: number
  lastSupplier: { id: string; name: string } | null
  lastPrice: number
  estimatedCost: number
}

interface StockAgeItem {
  product: { id: string; name: string; unit: string; category: string | null }
  stock: number
  inventoryValue: number
  ageDays: number
  ageGroup: string
}

interface ABCItem {
  product: { id: string; name: string; unit: string; category: string | null }
  revenue: number
  quantity: number
  stock: number
  grade: string
  cumulativePct: number
}

// ==========================================
// Component
// ==========================================

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"reorder" | "stock_age" | "abc">("reorder")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">仓库分析</h1>
        <p className="text-sm text-muted-foreground">智能补货、库龄分析、ABC分类</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === "reorder" ? "default" : "outline"} size="sm" onClick={() => setTab("reorder")}>
          <ShoppingCart className="h-4 w-4 mr-1" />智能补货
        </Button>
        <Button variant={tab === "stock_age" ? "default" : "outline"} size="sm" onClick={() => setTab("stock_age")}>
          <Clock className="h-4 w-4 mr-1" />库龄分析
        </Button>
        <Button variant={tab === "abc" ? "default" : "outline"} size="sm" onClick={() => setTab("abc")}>
          <BarChart3 className="h-4 w-4 mr-1" />ABC分类
        </Button>
      </div>

      {tab === "reorder" && <ReorderPanel />}
      {tab === "stock_age" && <StockAgePanel />}
      {tab === "abc" && <ABCPanel />}
    </div>
  )
}

// ==========================================
// Reorder Panel
// ==========================================

function ReorderPanel() {
  const [data, setData] = useState<{ total: number; totalEstimatedCost: number; items: ReorderItem[] } | null>(null)

  useEffect(() => {
    api<typeof data>("/api/warehouse-analytics?type=reorder").then((res) => {
      if (res.success && res.data) setData(res.data)
    })
  }, [])

  if (!data) return <p className="text-muted-foreground">加载中...</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">需补货商品</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{data.total}</span>
              <span className="text-sm text-muted-foreground">种</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">预估采购金额</CardTitle></CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">¥{data.totalEstimatedCost.toFixed(0)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">当前库存</TableHead>
                <TableHead className="text-right">建议采购</TableHead>
                <TableHead>上次供应商</TableHead>
                <TableHead className="text-right">预估单价</TableHead>
                <TableHead className="text-right">预估金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">所有商品库存充足</TableCell></TableRow>
              ) : data.items.map((item) => (
                <TableRow key={item.product.id}>
                  <TableCell>
                    <div className="font-medium">{item.product.name}</div>
                    {item.product.category && <div className="text-xs text-muted-foreground">{item.product.category}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-red-600 font-mono">{item.currentStock}</span>
                    <span className="text-xs text-muted-foreground"> / {item.lowStockAlert}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-green-600">+{item.suggestedQty}</TableCell>
                  <TableCell className="text-sm">{item.lastSupplier?.name || "—"}</TableCell>
                  <TableCell className="text-right text-sm">¥{item.lastPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">¥{item.estimatedCost.toFixed(0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ==========================================
// Stock Age Panel
// ==========================================

function StockAgePanel() {
  const [data, setData] = useState<{
    summary: Array<{ group: string; count: number; value: number; items: number }>
    items: StockAgeItem[]
  } | null>(null)

  useEffect(() => {
    api<typeof data>("/api/warehouse-analytics?type=stock_age").then((res) => {
      if (res.success && res.data) setData(res.data)
    })
  }, [])

  if (!data) return <p className="text-muted-foreground">加载中...</p>

  const colors: Record<string, string> = {
    "0-30天": "bg-green-100 text-green-800",
    "31-60天": "bg-yellow-100 text-yellow-800",
    "61-90天": "bg-orange-100 text-orange-800",
    "90天以上": "bg-red-100 text-red-800",
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.summary.map((g) => (
          <Card key={g.group}>
            <CardHeader className="pb-1"><CardTitle className="text-sm"><Badge variant="secondary" className={colors[g.group]}>{g.group}</Badge></CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{g.count} 种</div>
              <div className="text-xs text-muted-foreground">库存 {g.items} 件 · ¥{g.value.toFixed(0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">库存</TableHead>
                <TableHead className="text-right">库存金额</TableHead>
                <TableHead className="text-right">库龄(天)</TableHead>
                <TableHead>分组</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.slice(0, 50).map((item) => (
                <TableRow key={item.product.id}>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell className="text-right font-mono">{item.stock}</TableCell>
                  <TableCell className="text-right">¥{item.inventoryValue.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono">{item.ageDays}</TableCell>
                  <TableCell><Badge variant="secondary" className={colors[item.ageGroup]}>{item.ageGroup}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ==========================================
// ABC Panel
// ==========================================

function ABCPanel() {
  const [data, setData] = useState<{
    totalRevenue: number
    summary: { A: { count: number; revenue: number }; B: { count: number; revenue: number }; C: { count: number; revenue: number } }
    items: ABCItem[]
  } | null>(null)

  useEffect(() => {
    api<typeof data>("/api/warehouse-analytics?type=abc").then((res) => {
      if (res.success && res.data) setData(res.data)
    })
  }, [])

  if (!data) return <p className="text-muted-foreground">加载中...</p>

  const gradeColors: Record<string, string> = { A: "bg-green-100 text-green-800", B: "bg-blue-100 text-blue-800", C: "bg-gray-100 text-gray-800" }
  const gradeDescs: Record<string, string> = { A: "核心商品（贡献80%营收）", B: "重要商品（贡献15%营收）", C: "长尾商品（贡献5%营收）" }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(["A", "B", "C"] as const).map((grade) => (
          <Card key={grade}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="secondary" className={gradeColors[grade]}>{grade}类</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{data.summary[grade].count} 种</div>
              <div className="text-xs text-muted-foreground">营收 ¥{data.summary[grade].revenue.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{gradeDescs[grade]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>等级</TableHead>
                <TableHead className="text-right">销售额</TableHead>
                <TableHead className="text-right">销量</TableHead>
                <TableHead className="text-right">累计占比</TableHead>
                <TableHead className="text-right">当前库存</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.slice(0, 50).map((item) => (
                <TableRow key={item.product.id}>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell><Badge variant="secondary" className={gradeColors[item.grade]}>{item.grade}</Badge></TableCell>
                  <TableCell className="text-right">¥{item.revenue.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                  <TableCell className="text-right text-sm">{item.cumulativePct}%</TableCell>
                  <TableCell className="text-right font-mono">{item.stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
