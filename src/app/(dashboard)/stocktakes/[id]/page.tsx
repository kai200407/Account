"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Play, Check, X } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  unit: string
  stock: number
}

interface StocktakeItem {
  id: string
  productId: string
  systemQty: number
  actualQty: number | null
  diffQty: number | null
  product: Product | null
}

interface StocktakeOrder {
  id: string
  stocktakeNo: string
  status: string
  warehouseName: string | null
  operatorName: string
  createdAt: string
  items: StocktakeItem[]
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "盘点中", color: "bg-blue-100 text-blue-800" },
  completed: { label: "已完成", color: "bg-green-100 text-green-800" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-800" },
}

export default function StocktakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isOwner } = useAuth()
  const [order, setOrder] = useState<StocktakeOrder | null>(null)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fetchOrder = useCallback(async () => {
    const res = await api<StocktakeOrder>(`/api/stocktakes/${id}`)
    if (res.success && res.data) {
      setOrder(res.data)
      // Init counts from existing actual values
      const c: Record<string, string> = {}
      res.data.items.forEach((i) => {
        if (i.actualQty !== null) c[i.id] = String(i.actualQty)
      })
      setCounts(c)
    }
  }, [id])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  const handleAction = async (action: string) => {
    const res = await api(`/api/stocktakes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ action }),
    })
    if (res.success) {
      toast.success(action === "start" ? "盘点已开始" : action === "complete" ? "盘点已完成" : "盘点已取消")
      if (action === "cancel") router.push("/stocktakes")
      else fetchOrder()
    } else {
      toast.error(res.error || "操作失败")
    }
  }

  const handleSaveCounts = async () => {
    if (!order) return
    setSaving(true)
    try {
      const countData = Object.entries(counts)
        .filter(([, v]) => v !== "")
        .map(([itemId, actualQty]) => ({ itemId, actualQty: parseInt(actualQty) }))

      const res = await api(`/api/stocktakes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "count", counts: countData }),
      })
      if (res.success) {
        toast.success("数量已保存")
        fetchOrder()
      } else {
        toast.error(res.error || "保存失败")
      }
    } finally {
      setSaving(false)
    }
  }

  if (!order) return <div className="p-8 text-center text-muted-foreground">加载中...</div>

  const s = STATUS_MAP[order.status] || STATUS_MAP.draft
  const allCounted = order.items.every((i) => i.actualQty !== null)
  const diffItems = order.items.filter((i) => i.diffQty !== null && i.diffQty !== 0)
  const isEditable = order.status === "in_progress"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/stocktakes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">盘点单 {order.stocktakeNo}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className={s.color}>{s.label}</Badge>
            {order.warehouseName && <span className="text-sm text-muted-foreground">仓库: {order.warehouseName}</span>}
            <span className="text-sm text-muted-foreground">· {order.items.length} 种商品</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {order.status === "draft" && (
          <Button onClick={() => handleAction("start")}>
            <Play className="h-4 w-4 mr-1" />开始盘点
          </Button>
        )}
        {isEditable && (
          <>
            <Button onClick={handleSaveCounts} disabled={saving}>
              {saving ? "保存中..." : "保存数量"}
            </Button>
            {isOwner && allCounted && (
              <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction("complete")}>
                <Check className="h-4 w-4 mr-1" />确认完成
              </Button>
            )}
          </>
        )}
        {(order.status === "draft" || order.status === "in_progress") && (
          <Button variant="outline" className="text-red-500" onClick={() => handleAction("cancel")}>
            <X className="h-4 w-4 mr-1" />取消
          </Button>
        )}
      </div>

      {/* Summary card for completed */}
      {order.status === "completed" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">盘点结果</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              共 {order.items.length} 种商品，其中 <strong className="text-red-600">{diffItems.length}</strong> 项有差异
              {diffItems.length > 0 && "，库存已自动调整"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">系统库存</TableHead>
                <TableHead className="text-right">
                  {isEditable ? "实际数量" : "实盘数量"}
                </TableHead>
                <TableHead className="text-right">差异</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id} className={item.diffQty && item.diffQty !== 0 ? "bg-yellow-50" : ""}>
                  <TableCell className="font-medium">
                    {item.product?.name || "—"}
                    <span className="text-xs text-muted-foreground ml-1">{item.product?.unit}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{item.systemQty}</TableCell>
                  <TableCell className="text-right">
                    {isEditable ? (
                      <Input
                        type="number"
                        min={0}
                        value={counts[item.id] ?? ""}
                        onChange={(e) => setCounts({ ...counts, [item.id]: e.target.value })}
                        placeholder="实际数量"
                        className="h-8 w-20 text-right ml-auto"
                      />
                    ) : (
                      <span className="font-mono">{item.actualQty ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.diffQty !== null ? (
                      <span className={item.diffQty > 0 ? "text-green-600" : item.diffQty < 0 ? "text-red-600" : ""}>
                        {item.diffQty > 0 ? "+" : ""}{item.diffQty}
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
