"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog"
import { Plus, ArrowUpCircle, ArrowDownCircle, Search } from "lucide-react"

// ==========================================
// Types
// ==========================================

interface Product {
  id: string
  name: string
  unit: string
  stock: number
}

interface StockMovement {
  id: string
  productId: string
  type: string
  quantity: number
  balanceAfter: number
  refType: string | null
  refId: string | null
  refNo: string | null
  notes: string | null
  operatorName: string
  createdAt: string
  product: Product
}

interface MovementListResponse {
  items: StockMovement[]
  total: number
  page: number
  totalPages: number
}

// ==========================================
// Helpers
// ==========================================

const TYPE_LABELS: Record<string, string> = {
  purchase_in: "采购入库",
  sale_out: "销售出库",
  return_in: "退货入库",
  cancel_purchase: "取消采购",
  cancel_sale: "取消销售",
  adjustment: "手动调整",
}

const TYPE_COLORS: Record<string, string> = {
  purchase_in: "bg-green-100 text-green-800",
  sale_out: "bg-red-100 text-red-800",
  return_in: "bg-blue-100 text-blue-800",
  cancel_purchase: "bg-orange-100 text-orange-800",
  cancel_sale: "bg-purple-100 text-purple-800",
  adjustment: "bg-yellow-100 text-yellow-800",
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// ==========================================
// Component
// ==========================================

export default function InventoryPage() {
  const { isOwner } = useAuth()
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // 加载商品列表（用于搜索匹配）
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")

  useEffect(() => {
    api<{ items: Product[] }>("/api/products?limit=500").then((res) => {
      if (res.success && res.data) setProducts(res.data.items)
    })
  }, [])

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter)
      if (selectedProductId) params.set("productId", selectedProductId)

      const res = await api<MovementListResponse>(`/api/stock-movements?${params}`)
      if (res.success && res.data) {
        setMovements(res.data.items)
        setTotal(res.data.total)
        setTotalPages(res.data.totalPages)
      }
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, selectedProductId])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  // 搜索时根据名称匹配商品
  const handleSearch = () => {
    if (!search.trim()) {
      setSelectedProductId("")
      setPage(1)
      return
    }
    const match = products.find((p) => p.name.includes(search.trim()))
    if (match) {
      setSelectedProductId(match.id)
      setPage(1)
    } else {
      setSelectedProductId("__no_match__") // 不会匹配任何流水
      setPage(1)
    }
  }

  const clearSearch = () => {
    setSearch("")
    setSelectedProductId("")
    setPage(1)
  }

  // 统计卡片
  const todayMovements = movements.filter((m) => {
    const today = new Date().toDateString()
    return new Date(m.createdAt).toDateString() === today
  })
  const todayIn = todayMovements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
  const todayOut = todayMovements.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">库存管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 条流水记录
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setAdjustOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            手动调整
          </Button>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日入库</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-600">{todayIn}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日出库</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-red-600">{todayOut}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总流水</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-sm text-muted-foreground ml-1">条</span>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          <Input
            placeholder="搜索商品名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-xs"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
          {selectedProductId && selectedProductId !== "__no_match__" && (
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              清除筛选
            </Button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v ?? "all"); setPage(1) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="purchase_in">采购入库</SelectItem>
            <SelectItem value="sale_out">销售出库</SelectItem>
            <SelectItem value="return_in">退货入库</SelectItem>
            <SelectItem value="cancel_purchase">取消采购</SelectItem>
            <SelectItem value="cancel_sale">取消销售</SelectItem>
            <SelectItem value="adjustment">手动调整</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 流水表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">变动</TableHead>
                <TableHead className="text-right">余额</TableHead>
                <TableHead className="hidden md:table-cell">关联单号</TableHead>
                <TableHead className="hidden md:table-cell">操作人</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    暂无库存流水
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(m.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{m.product.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={TYPE_COLORS[m.type] || ""}>
                        {TYPE_LABELS[m.type] || m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={m.quantity > 0 ? "text-green-600" : "text-red-600"}>
                        {m.quantity > 0 ? "+" : ""}{m.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{m.balanceAfter}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {m.refNo || m.notes || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {m.operatorName}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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

      {/* 手动调整弹窗 */}
      <StockAdjustmentDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onSuccess={fetchMovements}
      />
    </div>
  )
}
