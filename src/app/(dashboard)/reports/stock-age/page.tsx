"use client"

import { useState, useEffect, useCallback } from "react"
import { api, getToken } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Download, Clock, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

// ==========================================
// 类型定义
// ==========================================

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

interface ProductOption {
  id: string
  name: string
}

// ==========================================
// 页面组件
// ==========================================

export default function StockAgePage() {
  const [data, setData] = useState<StockAgeData | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (productId?: string) => {
    setLoading(true)
    const url = productId && productId !== "all"
      ? `/api/reports/stock-age?productId=${productId}`
      : "/api/reports/stock-age"
    const res = await api<StockAgeData>(url)
    if (res.success && res.data) {
      setData(res.data)
    }
    setLoading(false)
  }, [])

  // 加载商品列表用于筛选
  useEffect(() => {
    void (async () => {
      const res = await api<{ products: ProductOption[] }>("/api/products?pageSize=9999&active=true")
      if (res.success && res.data) {
        setProducts(res.data.products ?? [])
      }
    })()
  }, [])

  // 初始加载数据
  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleProductChange = (value: string | null) => {
    const v = value ?? "all"
    setSelectedProduct(v)
    void fetchData(v === "all" ? undefined : v)
  }

  const handleExport = async () => {
    const token = getToken()
    if (!token) {
      toast.error("登录已过期，请重新登录")
      return
    }

    const params = new URLSearchParams({ type: "stock-age" })
    if (selectedProduct && selectedProduct !== "all") {
      params.set("productId", selectedProduct)
    }

    const res = await fetch(`/api/export?${params.toString()}`, {
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
    const fileName = match?.[1] || "stock_age.xlsx"

    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  }

  const bucketColors = [
    "text-green-600",
    "text-blue-600",
    "text-yellow-600",
    "text-orange-600",
    "text-red-600",
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">库龄分析</h2>
        <div className="flex items-center gap-2">
          <Select value={selectedProduct} onValueChange={(v) => { if (v !== null) handleProductChange(v) }}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="全部商品" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部商品</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { void handleExport() }}>
            <Download className="h-3.5 w-3.5 mr-1" />
            导出 Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : data ? (
        <>
          {/* 库龄分布卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {data.buckets.map((bucket, idx) => (
              <Card key={bucket.range}>
                <CardContent className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{bucket.label}</p>
                  </div>
                  <p className={`text-lg font-bold ${bucketColors[idx]}`}>
                    ¥{bucket.totalValue.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bucket.batchCount}批次 · {bucket.totalQty}件
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 批次明细表格 */}
          <Card>
            <CardContent className="p-0">
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品名</TableHead>
                      <TableHead>批次号</TableHead>
                      <TableHead>入库日期</TableHead>
                      <TableHead className="text-right">存放天数</TableHead>
                      <TableHead className="text-right">剩余数量</TableHead>
                      <TableHead className="text-right">成本价</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>保质期状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.details.map((item) => (
                      <TableRow
                        key={item.id}
                        className={item.expiryStatus === "expired" ? "bg-red-50" : item.expiryStatus === "expiring_soon" ? "bg-orange-50" : ""}
                      >
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.batchNo}</TableCell>
                        <TableCell className="text-muted-foreground">{item.createdAt}</TableCell>
                        <TableCell className="text-right font-mono">{item.daysStored}天</TableCell>
                        <TableCell className="text-right font-mono">{item.remainingQty}</TableCell>
                        <TableCell className="text-right font-mono">¥{item.costPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">¥{item.stockValue.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.expiryStatus === "expired" ? (
                            <Badge variant="destructive" className="text-xs">已过期</Badge>
                          ) : item.expiryStatus === "expiring_soon" ? (
                            <Badge className="text-xs bg-orange-500 hover:bg-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              即将过期
                            </Badge>
                          ) : item.expiryDate ? (
                            <Badge variant="secondary" className="text-xs">正常</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.details.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          暂无批次数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端列表 */}
              <div className="md:hidden divide-y">
                {data.details.map((item) => (
                  <div
                    key={item.id}
                    className={`px-3 py-2 space-y-1 ${
                      item.expiryStatus === "expired" ? "bg-red-50" : item.expiryStatus === "expiring_soon" ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.productName}</span>
                        {item.expiryStatus === "expired" ? (
                          <Badge variant="destructive" className="text-xs">已过期</Badge>
                        ) : item.expiryStatus === "expiring_soon" ? (
                          <Badge className="text-xs bg-orange-500 hover:bg-orange-600">即将过期</Badge>
                        ) : null}
                      </div>
                      <span className="font-mono text-sm">¥{item.stockValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.batchNo} · {item.createdAt}</span>
                      <span>{item.daysStored}天 · {item.remainingQty}件</span>
                    </div>
                  </div>
                ))}
                {data.details.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">暂无批次数据</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
