"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { getToken } from "@/lib/api-client"
import { Download } from "lucide-react"

interface ProfitData {
  totalRevenue: number
  totalProfit: number
  totalPurchase: number
  wholesaleRevenue: number
  retailRevenue: number
  totalOrders: number
  daily: Array<{ date: string; revenue: number; profit: number; orders: number }>
}

interface ProductRank {
  name: string
  totalQty: number
  totalRevenue: number
  totalProfit: number
}

interface CustomerRank {
  name: string
  type: string
  totalAmount: number
  totalProfit: number
  orderCount: number
  balance: number
}

interface TrendData {
  monthly: Array<{ month: string; revenue: number; profit: number; orders: number }>
  comparison: { revenueChange: number; profitChange: number; ordersChange: number }
}

interface InventoryData {
  totalInventoryValue: number
  totalProducts: number
  totalStock: number
  byCategory: Array<{ name: string; value: number; count: number }>
}

export default function ReportsPage() {
  const [tab, setTab] = useState("profit")

  // 日期范围（默认本月）
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const today = now.toISOString().slice(0, 10)

  const [startDate, setStartDate] = useState(monthStart)
  const [endDate, setEndDate] = useState(today)

  const [profit, setProfit] = useState<ProfitData | null>(null)
  const [products, setProducts] = useState<{ bestsellers: ProductRank[]; slowMoving: ProductRank[] } | null>(null)
  const [customers, setCustomers] = useState<{ customers: CustomerRank[] } | null>(null)
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [inventory, setInventory] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async (type: string) => {
    setLoading(true)
    const params = type === "trend" || type === "inventory"
      ? `type=${type}`
      : `type=${type}&start=${startDate}&end=${endDate}`
    const res = await api<unknown>(`/api/reports?${params}`)
    if (res.success && res.data) {
      if (type === "profit") setProfit(res.data as ProfitData)
      if (type === "products") setProducts(res.data as { bestsellers: ProductRank[]; slowMoving: ProductRank[] })
      if (type === "customers") setCustomers(res.data as { customers: CustomerRank[] })
      if (type === "trend") setTrend(res.data as TrendData)
      if (type === "inventory") setInventory(res.data as InventoryData)
    }
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => {
    fetchReport(tab)
  }, [tab, fetchReport])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">报表统计</h2>
        <div className="flex gap-1">
          {[
            { type: "sales", label: "销售" },
            { type: "purchases", label: "进货" },
          ].map(({ type: t, label }) => (
            <Button
              key={t}
              variant="outline"
              size="sm"
              onClick={() => {
                const token = getToken()
                window.open(
                  `/api/export?type=${t}&start=${startDate}&end=${endDate}&token=${token}`,
                  "_blank"
                )
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* 日期范围 */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">开始日期</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
        </div>
        <span className="pb-2 text-muted-foreground">~</span>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">结束日期</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="profit" className="flex-1 text-xs">利润</TabsTrigger>
          <TabsTrigger value="trend" className="flex-1 text-xs">趋势</TabsTrigger>
          <TabsTrigger value="inventory" className="flex-1 text-xs">库存</TabsTrigger>
          <TabsTrigger value="products" className="flex-1 text-xs">商品</TabsTrigger>
          <TabsTrigger value="customers" className="flex-1 text-xs">客户</TabsTrigger>
        </TabsList>

        {/* 利润报表 */}
        <TabsContent value="profit" className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : profit ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">总销售额</p>
                    <p className="text-xl font-bold">¥{profit.totalRevenue.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">总利润</p>
                    <p className="text-xl font-bold text-green-600">¥{profit.totalProfit.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">总进货额</p>
                    <p className="text-xl font-bold text-blue-600">¥{profit.totalPurchase.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">订单数</p>
                    <p className="text-xl font-bold">{profit.totalOrders}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-3 text-sm">
                <span>批发: <b>¥{profit.wholesaleRevenue.toFixed(2)}</b></span>
                <span>零售: <b>¥{profit.retailRevenue.toFixed(2)}</b></span>
                {profit.totalRevenue > 0 && (
                  <span>利润率: <b className="text-green-600">
                    {((profit.totalProfit / profit.totalRevenue) * 100).toFixed(1)}%
                  </b></span>
                )}
              </div>

              {/* 日报表 */}
              {profit.daily.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">每日明细</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {profit.daily.map((day) => (
                        <div key={day.date} className="px-3 py-2 flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{day.date}</span>
                            <span className="text-xs text-muted-foreground ml-2">{day.orders}单</span>
                          </div>
                          <div className="text-right">
                            <span>¥{day.revenue.toFixed(2)}</span>
                            <span className="text-green-600 ml-2">+¥{day.profit.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {profit.daily.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    该时间段内没有销售记录
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* 商品排行 */}
        <TabsContent value="products" className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : products ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    🔥 畅销商品
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {products.bestsellers.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">暂无数据</p>
                  ) : (
                    <div className="divide-y">
                      {products.bestsellers.map((p, i) => (
                        <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-5">{i + 1}</span>
                            <span className="font-medium truncate">{p.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span>{p.totalQty}件</span>
                            <span className="text-green-600 ml-2">¥{p.totalProfit.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* 趋势分析 */}
        <TabsContent value="trend" className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : trend ? (
            <>
              {/* 本月 vs 上月 */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "销售额", change: trend.comparison.revenueChange, value: trend.monthly[trend.monthly.length - 1]?.revenue ?? 0 },
                  { label: "利润", change: trend.comparison.profitChange, value: trend.monthly[trend.monthly.length - 1]?.profit ?? 0 },
                  { label: "订单数", change: trend.comparison.ordersChange, value: trend.monthly[trend.monthly.length - 1]?.orders ?? 0 },
                ].map((item) => (
                  <Card key={item.label}>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">本月{item.label}</p>
                      <p className="text-lg font-bold">
                        {item.label === "订单数" ? item.value : `¥${item.value.toFixed(0)}`}
                      </p>
                      <p className={`text-xs font-medium ${item.change > 0 ? "text-green-600" : item.change < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {item.change > 0 ? "↑" : item.change < 0 ? "↓" : "—"}
                        {Math.abs(item.change).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 6个月趋势表格 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">近6个月趋势</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    <div className="px-3 py-2 flex text-xs text-muted-foreground font-medium">
                      <span className="w-20">月份</span>
                      <span className="flex-1 text-right">销售额</span>
                      <span className="flex-1 text-right">利润</span>
                      <span className="w-14 text-right">订单</span>
                    </div>
                    {trend.monthly.map((m) => (
                      <div key={m.month} className="px-3 py-2 flex text-sm">
                        <span className="w-20 text-muted-foreground">{m.month}</span>
                        <span className="flex-1 text-right font-medium">¥{m.revenue.toFixed(0)}</span>
                        <span className="flex-1 text-right text-green-600">¥{m.profit.toFixed(0)}</span>
                        <span className="w-14 text-right">{m.orders}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* 库存金额 */}
        <TabsContent value="inventory" className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : inventory ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">库存总额</p>
                    <p className="text-lg font-bold text-blue-600">¥{inventory.totalInventoryValue.toFixed(0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">商品种类</p>
                    <p className="text-lg font-bold">{inventory.totalProducts}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">总库存量</p>
                    <p className="text-lg font-bold">{inventory.totalStock}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">按分类</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {inventory.byCategory.map((cat) => (
                      <div key={cat.name} className="px-3 py-2 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{cat.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{cat.count}件</span>
                        </div>
                        <span className="font-bold text-blue-600">¥{cat.value.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* 客户统计 */}
        <TabsContent value="customers" className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : customers && customers.customers.length > 0 ? (
            customers.customers.map((c, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <Badge variant={c.type === "wholesale" ? "default" : "secondary"} className="text-xs">
                          {c.type === "wholesale" ? "批发" : "零售"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.orderCount}单 · 利润 ¥{c.totalProfit.toFixed(2)}
                        {c.balance > 0 && <span className="text-orange-500 ml-1">· 欠款 ¥{c.balance.toFixed(2)}</span>}
                      </p>
                    </div>
                    <span className="font-bold">¥{c.totalAmount.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                该时间段内没有客户交易记录
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
