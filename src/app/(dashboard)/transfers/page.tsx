"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, ArrowRightLeft } from "lucide-react"

interface TransferItem {
  id: string
  productId: string
  quantity: number
  product: { name: string; unit: string } | null
}

interface TransferOrder {
  id: string
  transferNo: string
  fromWarehouseName: string
  toWarehouseName: string
  status: string
  notes: string | null
  operatorName: string
  createdAt: string
  items: TransferItem[]
}

function formatDate(d: string) {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export default function TransfersPage() {
  const [orders, setOrders] = useState<TransferOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true)
    setError("")
    api<{ items: TransferOrder[]; total: number; totalPages: number }>(`/api/transfers?page=${page}`).then((res) => {
      if (res.success && res.data) {
        setOrders(res.data.items)
        setTotal(res.data.total)
        setTotalPages(res.data.totalPages)
      } else {
        setError(res.error ?? "加载失败")
      }
    }).catch(() => {
      setError("加载失败")
    }).finally(() => {
      setLoading(false)
    })
  }, [page])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">调拨管理</h1>
          <p className="text-sm text-muted-foreground">共 {total} 条调拨记录</p>
        </div>
        <Link href="/transfers/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            新建调拨
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>调拨单号</TableHead>
                <TableHead>调出 → 调入</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="hidden md:table-cell">操作人</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-red-500">{error}</TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无调拨记录</TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="font-mono text-sm">{o.transferNo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <span>{o.fromWarehouseName}</span>
                        <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{o.toWarehouseName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.items.map((i) => (
                        <span key={i.id} className="block">
                          {i.product?.name} × {i.quantity}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          o.status === "completed" ? "bg-green-100 text-green-800" :
                          o.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          o.status === "cancelled" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {o.status === "completed" ? "已完成" : o.status === "pending" ? "待处理" : o.status === "cancelled" ? "已取消" : o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{o.operatorName}</TableCell>
                  </TableRow>
                ))
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
