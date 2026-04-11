"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { Download } from "lucide-react"

// ==========================================
// Types
// ==========================================

interface Product {
  id: string
  name: string
  sku: string | null
  unit: string
}

interface Warehouse {
  id: string
  name: string
}

interface StockMovement {
  id: string
  productId: string
  warehouseId: string | null
  type: string
  quantity: number
  balanceAfter: number
  costPrice: number | null
  stockValueAfter: number | null
  refNo: string | null
  notes: string | null
  operatorName: string
  createdAt: string
  product: Product
}

interface DetailListResponse {
  items: StockMovement[]
  total: number
  page: number
  totalPages: number
}

// ==========================================
// Helpers
// ==========================================

const TYPE_LABELS: Record<string, string> = {
  purchase_in: "进货",
  sale_out: "销售",
  return_in: "退货",
  cancel_purchase: "取消采购",
  cancel_sale: "取消销售",
  adjustment: "调整",
  transfer_in: "调拨入库",
  transfer_out: "调拨出库",
}

const TYPE_COLORS: Record<string, string> = {
  purchase_in: "bg-green-100 text-green-800",
  sale_out: "bg-red-100 text-red-800",
  return_in: "bg-blue-100 text-blue-800",
  cancel_purchase: "bg-orange-100 text-orange-800",
  cancel_sale: "bg-purple-100 text-purple-800",
  adjustment: "bg-yellow-100 text-yellow-800",
  transfer_in: "bg-cyan-100 text-cyan-800",
  transfer_out: "bg-pink-100 text-pink-800",
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${mm}-${dd} ${hh}:${mi}`
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ==========================================
// Component
// ==========================================

export default function InventoryDetailPage() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  // 筛选
  const [productId, setProductId] = useState("")
  const [warehouseId, setWarehouseId] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // 下拉数据
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  // 加载商品和仓库列表
  useEffect(() => {
    api<{ items: Product[] }>("/api/products?limit=500").then((res) => {
      if (res.success && res.data) setProducts(res.data.items)
    })
    api<{ items: Warehouse[] }>("/api/warehouses").then((res) => {
      if (res.success && res.data) setWarehouses(res.data.items)
    })
  }, [])

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (productId) params.set("productId", productId)
      if (warehouseId) params.set("warehouseId", warehouseId)
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)

      const res = await api<DetailListResponse>(`/api/stock-movements/detail?${params}`)
      if (res.success && res.data) {
        setMovements(res.data.items)
        setTotal(res.data.total)
        setTotalPages(res.data.totalPages)
      }
    } finally {
      setLoading(false)
    }
  }, [page, productId, warehouseId, typeFilter, startDate, endDate])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const resetFilters = () => {
    setProductId("")
    setWarehouseId("")
    setTypeFilter("all")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  const exportExcel = () => {
    if (movements.length === 0) return

    const header = ["时间", "单据号", "商品", "SKU", "类型", "数量", "变动后库存", "单位成本", "变动后金额", "操作人", "备注"]
    const rows = movements.map((m) => [
      formatDateTime(m.createdAt),
      m.refNo ?? "",
      m.product.name,
      m.product.sku ?? "",
      TYPE_LABELS[m.type] ?? m.type,
      String(m.quantity > 0 ? `+${m.quantity}` : m.quantity),
      String(m.balanceAfter),
      m.costPrice !== null ? String(m.costPrice) : "",
      m.stockValueAfter !== null ? String(m.stockValueAfter) : "",
      m.operatorName,
      m.notes ?? "",
    ])

    const csvContent = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `进销存明细账_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasActiveFilter = productId || warehouseId || (typeFilter && typeFilter !== "all") || startDate || endDate

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">进销存明细账</h1>
          <p className="text-sm text-muted-foreground">共 {total} 条流水记录</p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={movements.length === 0}>
          <Download className="h-4 w-4 mr-1" />
          导出 Excel
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Select value={productId || "__all__"} onValueChange={(v) => { const val = v ?? ""; setProductId(val === "__all__" ? "" : val); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部商品" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部商品</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={warehouseId || "__all__"} onValueChange={(v) => { const val = v ?? ""; setWarehouseId(val === "__all__" ? "" : val); setPage(1) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="全部仓库" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部仓库</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v ?? "all"); setPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="purchase_in">进货</SelectItem>
                <SelectItem value="sale_out">销售</SelectItem>
                <SelectItem value="return_in">退货</SelectItem>
                <SelectItem value="adjustment">调整</SelectItem>
                <SelectItem value="transfer_in">调拨入库</SelectItem>
                <SelectItem value="transfer_out">调拨出库</SelectItem>
              </SelectContent>
            </Select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              placeholder="开始日期"
            />
            <span className="self-center text-muted-foreground">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              placeholder="结束日期"
            />

            {hasActiveFilter && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                清除筛选
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 明细表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">时间</TableHead>
                  <TableHead className="whitespace-nowrap">单据号</TableHead>
                  <TableHead className="whitespace-nowrap">商品</TableHead>
                  <TableHead className="whitespace-nowrap">类型</TableHead>
                  <TableHead className="text-right whitespace-nowrap">数量</TableHead>
                  <TableHead className="text-right whitespace-nowrap">变动后库存</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden md:table-cell">单位成本</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden md:table-cell">变动后金额</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">操作人</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      暂无明细记录
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.refNo ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {m.product.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={TYPE_COLORS[m.type] || ""}>
                          {TYPE_LABELS[m.type] || m.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        <span className={m.quantity > 0 ? "text-green-600" : "text-red-600"}>
                          {m.quantity > 0 ? "+" : ""}{m.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.balanceAfter}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell">
                        {m.costPrice !== null ? `¥${formatMoney(m.costPrice)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell">
                        {m.stockValueAfter !== null ? `¥${formatMoney(m.stockValueAfter)}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {m.operatorName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate hidden lg:table-cell">
                        {m.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
