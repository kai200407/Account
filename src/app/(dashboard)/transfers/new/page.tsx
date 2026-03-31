"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WarehouseSelector } from "@/components/warehouse-selector"
import { ArrowLeft, Trash2, ArrowRightLeft } from "lucide-react"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  unit: string
  stock: number
}

interface TransferItem {
  productId: string
  productName: string
  unit: string
  quantity: number
}

export default function NewTransferPage() {
  const router = useRouter()
  const [fromWarehouseId, setFromWarehouseId] = useState("")
  const [toWarehouseId, setToWarehouseId] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<TransferItem[]>([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api<{ items: Product[] }>("/api/products?limit=500").then((res) => {
      if (res.success && res.data) setProducts(res.data.items)
    })
  }, [])

  const addItem = (productId: string) => {
    if (!productId) return
    if (items.find((i) => i.productId === productId)) return toast.error("商品已添加")
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setItems([...items, { productId, productName: product.name, unit: product.unit, quantity: 1 }])
  }

  const updateQuantity = (index: number, quantity: number) => {
    setItems(items.map((item, i) => i === index ? { ...item, quantity: Math.max(1, quantity) } : item))
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!fromWarehouseId) return toast.error("请选择调出仓库")
    if (!toWarehouseId) return toast.error("请选择调入仓库")
    if (fromWarehouseId === toWarehouseId) return toast.error("调出和调入仓库不能相同")
    if (items.length === 0) return toast.error("请添加调拨商品")

    setLoading(true)
    try {
      const res = await api("/api/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          notes: notes.trim() || null,
        }),
      })
      if (res.success) {
        toast.success("调拨单已创建")
        router.push("/transfers")
      } else {
        toast.error(res.error || "创建失败")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">新建调拨单</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">仓库选择</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">调出仓库</Label>
              <WarehouseSelector value={fromWarehouseId} onChange={setFromWarehouseId} />
            </div>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground mb-2.5" />
            <div className="space-y-1">
              <Label className="text-xs">调入仓库</Label>
              <WarehouseSelector value={toWarehouseId} onChange={setToWarehouseId} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">调拨商品</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            onChange={(e) => { addItem(e.target.value); e.target.value = "" }}
            className="h-10 w-full rounded-md border px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>选择商品添加...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}（库存: {p.stock}{p.unit}）</option>
            ))}
          </select>

          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">请添加调拨商品</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.productId} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">{item.productName}</span>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                    className="h-8 w-20 text-center"
                  />
                  <span className="text-xs text-muted-foreground w-6">{item.unit}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="备注（可选）"
      />

      <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={loading}>
        {loading ? "提交中..." : "确认调拨"}
      </Button>
    </div>
  )
}
