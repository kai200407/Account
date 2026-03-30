"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ReturnItem {
  id: string
  quantity: number
  unitPrice: number
  subtotal: number
  product: { name: string; unit: string }
}

interface ReturnOrder {
  id: string
  returnNo: string
  totalAmount: number
  reason: string | null
  returnDate: string
  saleOrder: { orderNo: string }
  customer: { name: string } | null
  items: ReturnItem[]
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await api<{ items: ReturnOrder[]; total: number; totalPages: number }>(
      `/api/returns?page=${page}`
    )
    if (res.success && res.data) {
      setReturns(res.data.items)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    }
    setLoading(false)
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">退货记录</h2>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : returns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无退货记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {returns.map((ret) => (
            <Card key={ret.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <span className="text-xs text-muted-foreground">{ret.returnNo}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-medium text-sm">
                        {ret.customer?.name ?? "散客"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        原单: {ret.saleOrder.orderNo}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(ret.returnDate)}</span>
                </div>

                <div className="text-xs text-muted-foreground mb-1.5">
                  {ret.items.map((item) => (
                    <span key={item.id} className="mr-2">
                      {item.product.name}×{item.quantity}
                    </span>
                  ))}
                </div>

                {ret.reason && (
                  <p className="text-xs text-muted-foreground mb-1">原因: {ret.reason}</p>
                )}

                <div className="text-sm">
                  <span>退款: <b className="text-red-600">¥{Number(ret.totalAmount).toFixed(2)}</b></span>
                </div>
              </CardContent>
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">共 {total} 条</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  上一页
                </Button>
                <span className="text-sm leading-8">{page}/{totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
