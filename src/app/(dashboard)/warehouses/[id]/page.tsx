"use client"

import { useState, useEffect, useCallback, use } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"

interface Warehouse {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  unit: string
  sku: string | null
  stock: number
}

interface WarehouseStockItem {
  id: string
  productId: string
  quantity: number
  product: Product | null
}

interface StockResponse {
  warehouse: Warehouse
  items: WarehouseStockItem[]
  total: number
  page: number
  totalPages: number
}

export default function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<StockResponse | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), search })
      const res = await api<StockResponse>(`/api/warehouses/${id}/stock?${p}`)
      if (res.success && res.data) setData(res.data)
    } finally {
      setLoading(false)
    }
  }, [id, page, search])

  useEffect(() => {
    fetchStock()
  }, [fetchStock])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/warehouses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{data?.warehouse?.name || "仓库"} — 库存明细</h1>
          <p className="text-sm text-muted-foreground">共 {data?.total || 0} 种商品有库存</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="搜索商品名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setPage(1)}
          className="max-w-xs"
        />
        <Button variant="outline" size="icon" onClick={() => setPage(1)}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品名称</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">仓库库存</TableHead>
                <TableHead className="text-right">总库存</TableHead>
                <TableHead>单位</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : !data?.items.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">暂无库存</TableCell>
                </TableRow>
              ) : (
                data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.product?.sku || "—"}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{item.product?.stock || 0}</TableCell>
                    <TableCell>{item.product?.unit || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="flex items-center text-sm text-muted-foreground">{page} / {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  )
}
