"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface SaleOrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  product: { name: string; unit: string }
}

interface SaleOrder {
  id: string
  orderNo: string
  items: SaleOrderItem[]
}

interface ReturnFormProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  saleOrder: SaleOrder | null
}

export function ReturnForm({ open, onClose, onSaved, saleOrder }: ReturnFormProps) {
  const [loading, setLoading] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (open && saleOrder) {
      const initial: Record<string, number> = {}
      saleOrder.items.forEach((item) => {
        initial[item.productId] = 0
      })
      setQuantities(initial)
      setReason("")
    }
  }, [open, saleOrder])

  if (!saleOrder) return null

  const returnItems = saleOrder.items.filter(
    (item) => (quantities[item.productId] ?? 0) > 0
  )

  const totalReturnAmount = returnItems.reduce((sum, item) => {
    const qty = quantities[item.productId] ?? 0
    return sum + qty * Number(item.unitPrice)
  }, 0)

  async function handleSubmit() {
    if (!saleOrder) return
    if (returnItems.length === 0) {
      toast.error("请至少填写一个退货数量")
      return
    }

    for (const item of returnItems) {
      const qty = quantities[item.productId]
      if (qty > item.quantity) {
        toast.error(`${item.product.name} 退货数量不能超过 ${item.quantity}`)
        return
      }
    }

    setLoading(true)
    try {
      const res = await api("/api/returns", {
        method: "POST",
        body: JSON.stringify({
          saleOrderId: saleOrder.id,
          items: returnItems.map((item) => ({
            productId: item.productId,
            quantity: quantities[item.productId],
          })),
          reason: reason.trim() || null,
        }),
      })

      if (res.success) {
        toast.success("退货成功")
        onSaved()
        onClose()
      } else {
        toast.error(res.error ?? "退货失败")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>退货 — {saleOrder.orderNo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            请填写每个商品的退货数量（不退填 0）
          </p>

          {saleOrder.items.map((item) => (
            <div key={item.productId} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  已售 {item.quantity}{item.product.unit} × ¥{Number(item.unitPrice).toFixed(2)}
                </p>
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  min={0}
                  max={item.quantity}
                  value={quantities[item.productId] ?? 0}
                  onChange={(e) =>
                    setQuantities({
                      ...quantities,
                      [item.productId]: parseInt(e.target.value) || 0,
                    })
                  }
                  className="h-9 text-sm"
                />
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label>退货原因</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="可选，如：质量问题、客户不要了"
              className="h-11"
            />
          </div>

          {totalReturnAmount > 0 && (
            <div className="flex justify-between text-lg font-bold">
              <span>退款总额</span>
              <span className="text-red-600">¥{totalReturnAmount.toFixed(2)}</span>
            </div>
          )}

          <Button
            className="w-full h-11"
            onClick={handleSubmit}
            disabled={loading || returnItems.length === 0}
          >
            {loading ? "处理中..." : "确认退货"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
