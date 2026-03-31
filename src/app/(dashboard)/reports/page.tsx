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
    const noDateTypes = ["trend", "inventory", "warehouse_util", "batch_expiry"]
    const params = noDateTypes.includes(type)
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
        <TabsList className="w-full flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="profit" className="flex-1 text-xs">利润</TabsTrigger>
          <TabsTrigger value="trend" className="flex-1 text-xs">趋势</TabsTrigger>
          <TabsTrigger value="inventory" className="flex-1 text-xs">库存</TabsTrigger>
          <TabsTrigger value="products" className="flex-1 text-xs">商品</TabsTrigger>
          <TabsTrigger value="customers" className="flex-1 text-xs">客户</TabsTrigger>
          <TabsTrigger value="movements" className="flex-1 text-xs">出入库</TabsTrigger>
          <TabsTrigger value="turnover" className="flex-1 text-xs">周转</TabsTrigger>
          <TabsTrigger value="stocktake_variance" className="flex-1 text-xs">盘差</TabsTrigger>
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

        {/* 出入库汇总 */}
        <TabsContent value="movements" className="space-y-4">
          <WarehouseReportPanel type="movements" startDate={startDate} endDate={endDate} loading={loading} />
        </TabsContent>

        {/* 库存周转率 */}
        <TabsContent value="turnover" className="space-y-4">
          <WarehouseReportPanel type="turnover" startDate={startDate} endDate={endDate} loading={loading} />
        </TabsContent>

        {/* 盘点差异 */}
        <TabsContent value="stocktake_variance" className="space-y-4">
          <WarehouseReportPanel type="stocktake_variance" startDate={startDate} endDate={endDate} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ==========================================
// Warehouse Report Panels (Phase 6)
// ==========================================

const TYPE_LABELS: Record<string, string> = {
  purchase_in: "采购入库", sale_out: "销售出库", return_in: "退货入库",
  cancel_purchase: "取消采购", cancel_sale: "取消销售", adjustment: "手动调整",
  transfer_in: "调拨入库", transfer_out: "调拨出库",
}

function WarehouseReportPanel({ type, startDate, endDate, loading: parentLoading }: {
  type: string; startDate: string; endDate: string; loading: boolean
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const noDateTypes = ["warehouse_util", "batch_expiry"]
    const params = noDateTypes.includes(type)
      ? `type=${type}`
      : `type=${type}&start=${startDate}&end=${endDate}`
    api<Record<string, unknown>>(`/api/reports?${params}`).then((res) => {
      if (res.success && res.data) setData(res.data)
      setLoading(false)
    })
  }, [type, startDate, endDate])

  if (loading || parentLoading) return <p className="text-center text-muted-foreground py-8">加载中...</p>
  if (!data) return <p className="text-center text-muted-foreground py-8">暂无数据</p>

  // ==========================================
  // 出入库汇总
  // ==========================================
  if (type === "movements") {
    const d = data as {
      totalMovements: number; totalIn: number; totalOut: number
      byType: Array<{ type: string; count: number; totalQty: number }>
      byProduct: Array<{ name: string; inQty: number; outQty: number; movements: number }>
    }
    return (
      <>
        <div className="grid grid-cols-3 gap-2">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">总流水</p>
            <p className="text-lg font-bold">{d.totalMovements}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">总入库</p>
            <p className="text-lg font-bold text-green-600">+{d.totalIn}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">总出库</p>
            <p className="text-lg font-bold text-red-600">-{d.totalOut}</p>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">按类型</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {d.byType.map((t) => (
                <div key={t.type} className="px-3 py-2 flex justify-between text-sm">
                  <span>{TYPE_LABELS[t.type] || t.type}</span>
                  <span className="font-mono">{t.count}次 · {t.totalQty}件</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">按商品</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {d.byProduct.map((p, i) => (
                <div key={i} className="px-3 py-2 flex justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex gap-3">
                    <span className="text-green-600">入{p.inQty}</span>
                    <span className="text-red-600">出{p.outQty}</span>
                    <span className="text-muted-foreground">{p.movements}次</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  // ==========================================
  // 库存周转率
  // ==========================================
  if (type === "turnover") {
    const d = data as {
      totalCOGS: number; avgInventory: number; turnoverRate: number; daysOfInventory: number; daysPeriod: number
      byProduct: Array<{ name: string; category: string; stock: number; inventoryValue: number; cogs: number; turnoverRate: number }>
    }
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">周转率</p>
            <p className="text-xl font-bold">{d.turnoverRate}次</p>
            <p className="text-xs text-muted-foreground">{d.daysPeriod}天内</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">存货天数</p>
            <p className="text-xl font-bold">{d.daysOfInventory > 999 ? "∞" : d.daysOfInventory}天</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">销售成本</p>
            <p className="text-lg font-bold">¥{d.totalCOGS.toFixed(0)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">平均库存</p>
            <p className="text-lg font-bold">¥{d.avgInventory.toFixed(0)}</p>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">商品周转排行</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {d.byProduct.slice(0, 20).map((p, i) => (
                <div key={i} className="px-3 py-2 flex justify-between text-sm">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-1">{p.category}</span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <span className="font-mono">{p.turnoverRate}次</span>
                    <span className="text-muted-foreground">库存{p.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  // ==========================================
  // 盘点差异
  // ==========================================
  if (type === "stocktake_variance") {
    const d = data as {
      totalStocktakes: number; totalDiffItems: number; totalPositive: number; totalNegative: number
      items: Array<{ stocktakeNo: string; product: { name: string; unit: string }; systemQty: number; actualQty: number; diffQty: number }>
    }
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">盘点次数</p>
            <p className="text-lg font-bold">{d.totalStocktakes}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">差异项数</p>
            <p className="text-lg font-bold text-orange-600">{d.totalDiffItems}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">盘盈总量</p>
            <p className="text-lg font-bold text-green-600">+{d.totalPositive}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">盘亏总量</p>
            <p className="text-lg font-bold text-red-600">-{d.totalNegative}</p>
          </CardContent></Card>
        </div>

        {d.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">差异明细</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {d.items.map((item, i) => (
                  <div key={i} className="px-3 py-2 flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{item.product.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">{item.stocktakeNo}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <span className="text-muted-foreground">系统{item.systemQty}</span>
                      <span>实际{item.actualQty}</span>
                      <span className={item.diffQty > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {item.diffQty > 0 ? "+" : ""}{item.diffQty}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </>
    )
  }

  return <p className="text-center text-muted-foreground py-8">暂无数据</p>
}
