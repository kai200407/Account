"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, XCircle, Undo2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ReturnForm } from "@/components/return-form"

interface OrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
  product: { name: string; unit: string }
}

interface Order {
  id: string
  orderNo: string
  totalAmount: number
  paidAmount: number
  profit?: number
  saleType?: string
  orderDate: string
  status: string
  notes: string | null
  supplier?: { name: string }
  customer?: { name: string } | null
  items: OrderItem[]
}

interface OrderListProps {
  type: "purchase" | "sale"
}

export function OrderList({ type }: OrderListProps) {
  const { isOwner } = useAuth()
  const isPurchase = type === "purchase"
  const title = isPurchase ? "进货记录" : "销售记录"
  const apiPath = isPurchase ? "/api/purchases" : "/api/sales"
  const newPath = isPurchase ? "/purchases/new" : "/sales/new"

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [returnOrder, setReturnOrder] = useState<Order | null>(null)
  const [returnFormOpen, setReturnFormOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await api<{ items: Order[]; total: number; totalPages: number }>(
      `${apiPath}?page=${page}`
    )
    if (res.success && res.data) {
      setOrders(res.data.items)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    }
    setLoading(false)
  }, [apiPath, page])

  useEffect(() => {
    void Promise.resolve().then(() => fetchData())
  }, [fetchData])

  async function handleCancel(order: Order) {
    const label = isPurchase ? "进货单" : "销售单"
    if (!confirm(`确定要取消${label} ${order.orderNo} 吗？\n取消后库存和余额将自动回滚。`)) return

    const res = await api(`${apiPath}/${order.id}`, {
      method: "PUT",
      body: JSON.stringify({ action: "cancel" }),
    })

    if (res.success) {
      toast.success(`${label}已取消`)
      fetchData()
    } else {
      toast.error(res.error ?? "取消失败")
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link href={newPath}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {isPurchase ? "新建进货" : "新建销售"}
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无{isPurchase ? "进货" : "销售"}记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const unpaid = Number(order.totalAmount) - Number(order.paidAmount)
            const contactName = isPurchase
              ? order.supplier?.name
              : order.customer?.name ?? "散客"
            const isCancelled = order.status === "cancelled"
            const canCancel = isOwner && order.status === "completed"

            return (
              <Card key={order.id} className={isCancelled ? "opacity-50" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <span className="text-xs text-muted-foreground">{order.orderNo}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-medium text-sm">{contactName}</span>
                        {isCancelled && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            已取消
                          </Badge>
                        )}
                        {!isPurchase && order.saleType && !isCancelled && (
                          <Badge variant={order.saleType === "wholesale" ? "default" : "secondary"} className="text-xs">
                            {order.saleType === "wholesale" ? "批发" : "零售"}
                          </Badge>
                        )}
                        {unpaid > 0 && !isCancelled && (
                          <Badge variant="destructive" className="text-xs">
                            欠¥{unpaid.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{formatDate(order.orderDate)}</span>
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => handleCancel(order)}
                          title="取消订单"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {!isPurchase && order.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-orange-500"
                          onClick={() => {
                            setReturnOrder(order)
                            setReturnFormOpen(true)
                          }}
                          title="退货"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 商品简列 */}
                  <div className="text-xs text-muted-foreground mb-1.5">
                    {order.items.slice(0, 3).map((item) => (
                      <span key={item.id} className="mr-2">
                        {item.product.name}×{item.quantity}
                      </span>
                    ))}
                    {order.items.length > 3 && <span>等{order.items.length}项</span>}
                  </div>

                  {/* 金额 — staff 不显示利润 */}
                  <div className="flex gap-4 text-sm">
                    <span>总额: <b>¥{Number(order.totalAmount).toFixed(2)}</b></span>
                    {!isPurchase && isOwner && order.profit !== undefined && !isCancelled && (
                      <span>利润: <b className="text-green-600">¥{Number(order.profit).toFixed(2)}</b></span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}

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

      {/* 退货表单弹窗 */}
      {!isPurchase && (
        <ReturnForm
          open={returnFormOpen}
          onClose={() => {
            setReturnFormOpen(false)
            setReturnOrder(null)
          }}
          onSaved={fetchData}
          saleOrder={returnOrder ? {
            id: returnOrder.id,
            orderNo: returnOrder.orderNo,
            items: returnOrder.items.map((i) => ({
              id: i.id,
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              product: i.product,
            })),
          } : null}
        />
      )}
    </div>
  )
}
