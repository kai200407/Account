"use client"

import { useState, useEffect, useCallback } from "react"
import { api, getToken } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Package, TrendingUp, DollarSign } from "lucide-react"
import { toast } from "sonner"

// ==========================================
// 类型定义
// ==========================================

interface OverviewItem {
  id: string
  name: string
  sku: string
  unit: string
  category: string
  stock: number
  costPrice: number
  stockValue: number
  lowStockAlert: number
  isLowStock: boolean
  warehouseDetails: Array<{ warehouse: string; quantity: number }>
}

interface OverviewData {
  totalProducts: number
  totalStock: number
  totalValue: number
  lowStockCount: number
  items: OverviewItem[]
}

interface MovementItem {
  id: string
  name: string
  unit: string
  openingQty: number
  inQty: number
  outQty: number
  closingQty: number
}

interface MovementData {
  periodStart: string
  periodEnd: string
  totalOpening: number
  totalIn: number
  totalOut: number
  totalClosing: number
  items: MovementItem[]
}

interface ValueData {
  totalValue: number
  totalCost: number
  totalStock: number
  totalProducts: number
  byCategory: Array<{ name: string; stockValue: number; stockQty: number; productCount: number }>
  byWarehouse: Array<{ id: string; name: string; stockQty: number; stockValue: number }>
}

// ==========================================
// 页面组件
// ==========================================

export default function InventoryReportPage() {
  const [tab, setTab] = useState("overview")
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [movement, setMovement] = useState<MovementData | null>(null)
  const [value, setValue] = useState<ValueData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async (type: string) => {
    setLoading(true)
    const res = await api<unknown>(`/api/reports/inventory?type=${type}`)
    if (res.success && res.data) {
      if (type === "overview") setOverview(res.data as OverviewData)
      if (type === "movement") setMovement(res.data as MovementData)
      if (type === "value") setValue(res.data as ValueData)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => fetchReport(tab))
  }, [tab, fetchReport])

  const handleExport = async () => {
    const token = getToken()
    if (!token) {
      toast.error("登录已过期，请重新登录")
      return
    }

    const res = await fetch(`/api/export?type=inventory&subtype=${tab}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      let message = "导出失败"
      try {
        const json = await res.json()
        if (json?.error) message = json.error
      } catch {}
      toast.error(message)
      return
    }

    const blob = await res.blob()
    const disposition = res.headers.get("content-disposition") || ""
    const match = disposition.match(/filename="?([^";]+)"?/)
    const fileName = match?.[1] || `inventory_${tab}.xlsx`

    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">库存报表</h2>
        <Button variant="outline" size="sm" onClick={() => { void handleExport() }}>
          <Download className="h-3.5 w-3.5 mr-1" />
          导出 Excel
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="overview" className="text-xs">库存总览</TabsTrigger>
          <TabsTrigger value="movement" className="text-xs">收发存汇总</TabsTrigger>
          <TabsTrigger value="value" className="text-xs">库存金额</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : overview ? (
            <OverviewPanel data={overview} />
          ) : null}
        </TabsContent>

        <TabsContent value="movement" className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : movement ? (
            <MovementPanel data={movement} />
          ) : null}
        </TabsContent>

        <TabsContent value="value" className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : value ? (
            <ValuePanel data={value} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ==========================================
// 库存总览
// ==========================================

function OverviewPanel({ data }: { data: OverviewData }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">商品种类</p>
            <p className="text-xl font-bold">{data.totalProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">总库存量</p>
            <p className="text-xl font-bold">{data.totalStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">库存总额</p>
            <p className="text-xl font-bold text-blue-600">¥{data.totalValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">低库存预警</p>
            <p className={`text-xl font-bold ${data.lowStockCount > 0 ? "text-orange-600" : ""}`}>
              {data.lowStockCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">商品库存明细</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 桌面端表格 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead className="text-right">库存</TableHead>
                  <TableHead className="text-right">成本价</TableHead>
                  <TableHead className="text-right">库存金额</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.sku && (
                          <span className="text-xs text-muted-foreground ml-1">({item.sku})</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.unit}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-right font-mono">{item.stock}</TableCell>
                    <TableCell className="text-right font-mono">¥{item.costPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">¥{item.stockValue.toFixed(2)}</TableCell>
                    <TableCell>
                      {item.isLowStock ? (
                        <Badge variant="destructive" className="text-xs">低库存</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">正常</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      暂无商品数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* 移动端列表 */}
          <div className="md:hidden divide-y">
            {data.items.map((item) => (
              <div key={item.id} className="px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    {item.isLowStock && <Badge variant="destructive" className="text-xs">低库存</Badge>}
                  </div>
                  <span className="font-mono text-sm">{item.stock}{item.unit}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.category}</span>
                  <span>¥{item.stockValue.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {data.items.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">暂无商品数据</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ==========================================
// 收发存汇总
// ==========================================

function MovementPanel({ data }: { data: MovementData }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">期初库存</p>
            <p className="text-xl font-bold">{data.totalOpening}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">期间入库</p>
            <p className="text-xl font-bold text-green-600">+{data.totalIn}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">期间出库</p>
            <p className="text-xl font-bold text-red-600">-{data.totalOut}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">期末库存</p>
            <p className="text-xl font-bold">{data.totalClosing}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            收发存明细 ({data.periodStart} ~ {data.periodEnd})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 桌面端表格 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">期初</TableHead>
                  <TableHead className="text-right">入库</TableHead>
                  <TableHead className="text-right">出库</TableHead>
                  <TableHead className="text-right">期末</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({item.unit})</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.openingQty}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">+{item.inQty}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">-{item.outQty}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{item.closingQty}</TableCell>
                  </TableRow>
                ))}
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      该时间段内无收发记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* 移动端列表 */}
          <div className="md:hidden divide-y">
            {data.items.map((item) => (
              <div key={item.id} className="px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono font-bold">{item.closingQty}{item.unit}</span>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">期初{item.openingQty}</span>
                  <span className="text-green-600">+{item.inQty}</span>
                  <span className="text-red-600">-{item.outQty}</span>
                </div>
              </div>
            ))}
            {data.items.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">该时间段内无收发记录</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ==========================================
// 库存金额统计
// ==========================================

function ValuePanel({ data }: { data: ValueData }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">库存总额</p>
            <p className="text-xl font-bold text-blue-600">¥{data.totalValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">成本总额</p>
            <p className="text-xl font-bold">¥{data.totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">总库存量</p>
            <p className="text-xl font-bold">{data.totalStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">商品种类</p>
            <p className="text-xl font-bold">{data.totalProducts}</p>
          </CardContent>
        </Card>
      </div>

      {/* 按分类 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">按分类汇总</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 桌面端 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分类</TableHead>
                  <TableHead className="text-right">商品数</TableHead>
                  <TableHead className="text-right">库存量</TableHead>
                  <TableHead className="text-right">库存金额</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byCategory.map((cat) => (
                  <TableRow key={cat.name}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-right">{cat.productCount}</TableCell>
                    <TableCell className="text-right font-mono">{cat.stockQty}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">¥{cat.stockValue.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {data.totalValue > 0 ? ((cat.stockValue / data.totalValue) * 100).toFixed(1) : "0.0"}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 移动端 */}
          <div className="md:hidden divide-y">
            {data.byCategory.map((cat) => (
              <div key={cat.name} className="px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">{cat.productCount}种 · {cat.stockQty}件</span>
                </div>
                <span className="font-bold text-blue-600">¥{cat.stockValue.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 按仓库 */}
      {data.byWarehouse.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">按仓库汇总</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* 桌面端 */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>仓库</TableHead>
                    <TableHead className="text-right">库存量</TableHead>
                    <TableHead className="text-right">库存金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byWarehouse.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-medium">{wh.name}</TableCell>
                      <TableCell className="text-right font-mono">{wh.stockQty}</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">¥{wh.stockValue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 移动端 */}
            <div className="md:hidden divide-y">
              {data.byWarehouse.map((wh) => (
                <div key={wh.id} className="px-3 py-2 flex items-center justify-between">
                  <span className="font-medium">{wh.name}</span>
                  <div className="text-right">
                    <span className="font-mono">{wh.stockQty}件</span>
                    <span className="font-bold text-blue-600 ml-2">¥{wh.stockValue.toFixed(0)}</span>
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
