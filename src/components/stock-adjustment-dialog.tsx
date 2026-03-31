"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  unit: string
  stock: number
}

interface StockAdjustmentDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** 预选商品 */
  productId?: string
}

export function StockAdjustmentDialog({
  open,
  onClose,
  onSuccess,
  productId: preselectedProductId,
}: StockAdjustmentDialogProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // 加载商品列表
  useEffect(() => {
    if (!open) return
    api<{ items: Product[] }>("/api/products?limit=500").then((res) => {
      if (res.success && res.data) {
        setProducts(res.data.items)
      }
    })
  }, [open])

  // 预选商品
  useEffect(() => {
    if (preselectedProductId) {
      setProductId(preselectedProductId)
    }
  }, [preselectedProductId])

  const selectedProduct = products.find((p) => p.id === productId)

  const handleSubmit = async () => {
    if (!productId) return toast.error("请选择商品")
    const qty = parseInt(quantity)
    if (isNaN(qty) || qty === 0) return toast.error("调整数量不能为0")
    if (!notes.trim()) return toast.error("请填写调整原因")

    setSubmitting(true)
    try {
      const res = await api("/api/stock-movements/adjust", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: qty, notes }),
      })
      if (res.success) {
        toast.success("库存调整成功")
        handleClose()
        onSuccess()
      } else {
        toast.error(res.error || "调整失败")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setProductId(preselectedProductId || "")
    setQuantity("")
    setNotes("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>手动库存调整</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>商品</Label>
            <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="选择商品" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}（当前库存: {p.stock}{p.unit}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <div className="text-sm text-muted-foreground">
              当前库存: <strong>{selectedProduct.stock}</strong> {selectedProduct.unit}
            </div>
          )}

          <div className="space-y-2">
            <Label>调整数量</Label>
            <Input
              type="number"
              placeholder="正数=增加库存, 负数=减少库存"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {quantity && selectedProduct && (
              <p className="text-xs text-muted-foreground">
                调整后库存: {selectedProduct.stock + (parseInt(quantity) || 0)} {selectedProduct.unit}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>调整原因（必填）</Label>
            <Textarea
              placeholder="例如: 盘点差异、报损、赠送等"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "提交中..." : "确认调整"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
