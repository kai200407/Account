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

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string | null
  unit: string
  categoryId: string | null
  costPrice: number
  wholesalePrice: number
  retailPrice: number
  specialPrice: number | null
  stock: number
  lowStockAlert: number
  notes: string | null
}

interface ProductFormProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  product?: Product | null
}

export function ProductForm({ open, onClose, onSaved, product }: ProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [unit, setUnit] = useState("个")
  const [categoryId, setCategoryId] = useState("")
  const [costPrice, setCostPrice] = useState("")
  const [wholesalePrice, setWholesalePrice] = useState("")
  const [retailPrice, setRetailPrice] = useState("")
  const [specialPrice, setSpecialPrice] = useState("")
  const [stock, setStock] = useState("")
  const [lowStockAlert, setLowStockAlert] = useState("10")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      api<Category[]>("/api/categories").then((res) => {
        if (res.success && res.data) setCategories(res.data)
      })

      if (product) {
        setName(product.name)
        setSku(product.sku ?? "")
        setUnit(product.unit)
        setCategoryId(product.categoryId ?? "")
        setCostPrice(String(product.costPrice))
        setWholesalePrice(String(product.wholesalePrice))
        setRetailPrice(String(product.retailPrice))
        setSpecialPrice(product.specialPrice != null ? String(product.specialPrice) : "")
        setStock(String(product.stock))
        setLowStockAlert(String(product.lowStockAlert))
        setNotes(product.notes ?? "")
      } else {
        setName("")
        setSku("")
        setUnit("个")
        setCategoryId("")
        setCostPrice("")
        setWholesalePrice("")
        setRetailPrice("")
        setSpecialPrice("")
        setStock("")
        setLowStockAlert("10")
        setNotes("")
      }
    }
  }, [open, product])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("请输入商品名称")
      return
    }

    setLoading(true)
    try {
      const data = {
        name: name.trim(),
        sku: sku.trim() || null,
        unit,
        categoryId: categoryId || null,
        costPrice: parseFloat(costPrice) || 0,
        wholesalePrice: parseFloat(wholesalePrice) || 0,
        retailPrice: parseFloat(retailPrice) || 0,
        specialPrice: specialPrice ? parseFloat(specialPrice) : null,
        stock: parseInt(stock) || 0,
        lowStockAlert: parseInt(lowStockAlert) || 10,
        notes: notes.trim() || null,
      }

      const url = product ? `/api/products/${product.id}` : "/api/products"
      const method = product ? "PUT" : "POST"

      const res = await api(url, {
        method,
        body: JSON.stringify(data),
      })

      if (res.success) {
        toast.success(product ? "商品已更新" : "商品已添加")
        onSaved()
        onClose()
      } else {
        toast.error(res.error ?? "操作失败")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "编辑商品" : "添加商品"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 商品名称 - 必填 */}
          <div className="space-y-1.5">
            <Label>商品名称 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：红外理疗灯 TDP-A"
              className="h-11"
              required
            />
          </div>

          {/* 分类 + 编号 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>分类</Label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-11 w-full rounded-md border px-3 text-sm"
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>编号</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="DL-001"
                className="h-11"
              />
            </div>
          </div>

          {/* 四种价格 - 核心 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>进价 (¥)</Label>
              <Input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>批发价 (¥)</Label>
              <Input
                type="number"
                step="0.01"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                placeholder="0.00"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>零售价 (¥)</Label>
              <Input
                type="number"
                step="0.01"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
                placeholder="0.00"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>特殊价 (¥)</Label>
              <Input
                type="number"
                step="0.01"
                value={specialPrice}
                onChange={(e) => setSpecialPrice(e.target.value)}
                placeholder="可选"
                className="h-11"
              />
            </div>
          </div>

          {/* 库存 + 单位 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>库存</Label>
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>单位</Label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-11 w-full rounded-md border px-3 text-sm"
              >
                {["个", "台", "套", "箱", "件", "只", "把", "条", "米", "组"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>低库存预警</Label>
              <Input
                type="number"
                value={lowStockAlert}
                onChange={(e) => setLowStockAlert(e.target.value)}
                placeholder="10"
                className="h-11"
              />
            </div>
          </div>

          {/* 备注 */}
          <div className="space-y-1.5">
            <Label>备注</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选"
              className="h-11"
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
