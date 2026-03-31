"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Plus } from "lucide-react"
import { toast } from "sonner"

interface StocktakeOrder {
  id: string
  stocktakeNo: string
  status: string
  operatorName: string
  createdAt: string
  completedAt: string | null
  items: { id: string }[]
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "盘点中", color: "bg-blue-100 text-blue-800" },
  completed: { label: "已完成", color: "bg-green-100 text-green-800" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-800" },
}

function formatDate(d: string) {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export default function StocktakesPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<StocktakeOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchOrders = useCallback(() => {
    api<{ items: StocktakeOrder[]; total: number; totalPages: number }>(`/api/stocktakes?page=${page}`).then((res) => {
      if (res.success && res.data) {
        setOrders(res.data.items)
        setTotal(res.data.total)
        setTotalPages(res.data.totalPages)
      }
    })
  }, [page])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleCreate = async () => {
    const res = await api<{ id: string }>("/api/stocktakes", {
      method: "POST",
      body: JSON.stringify({}),
    })
    if (res.success && res.data) {
      toast.success("盘点单已创建")
      router.push(`/stocktakes/${res.data.id}`)
    } else {
      toast.error(res.error || "创建失败")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">库存盘点</h1>
          <p className="text-sm text-muted-foreground">共 {total} 条盘点记录</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新建盘点
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>盘点单号</TableHead>
                <TableHead>商品数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无盘点记录</TableCell>
                </TableRow>
              ) : (
                orders.map((o) => {
                  const s = STATUS_MAP[o.status] || STATUS_MAP.draft
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{formatDate(o.createdAt)}</TableCell>
                      <TableCell className="font-mono text-sm">{o.stocktakeNo}</TableCell>
                      <TableCell>{o.items.length}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={s.color}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.operatorName}</TableCell>
                      <TableCell>
                        <Link href={`/stocktakes/${o.id}`}>
                          <Button variant="outline" size="sm">
                            {o.status === "draft" || o.status === "in_progress" ? "继续" : "查看"}
                          </Button>
                        </Link>
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
