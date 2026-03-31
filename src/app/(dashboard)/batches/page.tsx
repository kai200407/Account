"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Package } from "lucide-react"

interface Product {
  id: string
  name: string
  unit: string
}

interface Batch {
  id: string
  productId: string
  batchNo: string
  quantity: number
  productionDate: string | null
  expiryDate: string | null
  createdAt: string
  product: Product
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("zh-CN")
}

function getExpiryStatus(expiryDate: string | null): { label: string; color: string } | null {
  if (!expiryDate) return null
  const now = Date.now()
  const expiry = new Date(expiryDate).getTime()
  const daysLeft = Math.ceil((expiry - now) / 86400000)
  if (daysLeft < 0) return { label: "已过期", color: "bg-red-100 text-red-800" }
  if (daysLeft <= 7) return { label: `${daysLeft}天到期`, color: "bg-red-100 text-red-800" }
  if (daysLeft <= 30) return { label: `${daysLeft}天到期`, color: "bg-yellow-100 text-yellow-800" }
  return { label: `${daysLeft}天`, color: "bg-green-100 text-green-800" }
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [expiringBatches, setExpiringBatches] = useState<Batch[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [tab, setTab] = useState<"all" | "expiring">("all")

  const fetchBatches = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "20" })
    if (tab === "expiring") params.set("expiringSoon", "true")

    const res = await api<{ items: Batch[]; total: number; totalPages: number }>(`/api/batches?${params}`)
    if (res.success && res.data) {
      setBatches(res.data.items)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    }
  }, [page, tab])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  // Fetch expiring count separately
  useEffect(() => {
    api<{ items: Batch[]; total: number }>("/api/batches?expiringSoon=true&limit=5").then((res) => {
      if (res.success && res.data) setExpiringBatches(res.data.items)
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">批次管理</h1>
          <p className="text-sm text-muted-foreground">管理商品批次与效期</p>
        </div>
      </div>

      {/* 临期预警 */}
      {expiringBatches.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              临期预警 — {expiringBatches.length} 批次将在30天内到期
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {expiringBatches.map((b) => {
                const status = getExpiryStatus(b.expiryDate)
                return (
                  <div key={b.id} className="flex items-center gap-2 text-sm">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{b.product.name}</span>
                    <span className="text-muted-foreground">批次 {b.batchNo}</span>
                    <span className="text-muted-foreground">× {b.quantity}</span>
                    {status && <Badge variant="secondary" className={status.color}>{status.label}</Badge>}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab */}
      <div className="flex gap-2">
        <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => { setTab("all"); setPage(1) }}>
          全部批次
        </Button>
        <Button variant={tab === "expiring" ? "default" : "outline"} size="sm" onClick={() => { setTab("expiring"); setPage(1) }}>
          临期预警
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>批次号</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead>生产日期</TableHead>
                <TableHead>到期日期</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {tab === "expiring" ? "暂无临期批次" : "暂无批次记录。在采购入库时可录入批次信息。"}
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => {
                  const status = getExpiryStatus(b.expiryDate)
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.product.name}</TableCell>
                      <TableCell className="font-mono text-sm">{b.batchNo}</TableCell>
                      <TableCell className="text-right font-mono">{b.quantity}</TableCell>
                      <TableCell className="text-sm">{formatDate(b.productionDate)}</TableCell>
                      <TableCell className="text-sm">{formatDate(b.expiryDate)}</TableCell>
                      <TableCell>
                        {status ? (
                          <Badge variant="secondary" className={status.color}>{status.label}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">无效期</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="flex items-center text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  )
}
