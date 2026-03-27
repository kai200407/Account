"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  sku: string | null
  unit: string
  costPrice: number
  wholesalePrice: number
  retailPrice: number
  stock: number
}

interface OrderItem {
  productId: string
  productName: string
  unit: string
  quantity: number
  unitPrice: number
  subtotal: number
  stock: number
}

interface OrderFormProps {
  type: "purchase" | "sale"
}

export function OrderForm({ type }: OrderFormProps) {
  const router = useRouter()
  const isPurchase = type === "purchase"
  const title = isPurchase ? "新建进货单" : "新建销售单"

  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; customerType?: string }>>([])
  const [saleType, setSaleType] = useState<"wholesale" | "retail">("retail")

  // 表单
  const [contactId, setContactId] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [paidAmount, setPaidAmount] = useState("")
  const [notes, setNotes] = useState("")

  // 商品搜索
  const [searchText, setSearchText] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    api<Product[]>("/api/products?limit=200").then((res) => {
      if (res.success && res.data) {
        const list = "items" in res.data ? (res.data as unknown as { items: Product[] }).items : res.data
        setProducts(Array.isArray(list) ? list : [])
      }
    })

    const contactApi = isPurchase ? "/api/suppliers" : "/api/customers"
    api<Array<{ id: string; name: string; customerType?: string }>>(contactApi).then((res) => {
      if (res.success && res.data) setContacts(res.data)
    })
  }, [isPurchase])

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0)
  const paid = parseFloat(paidAmount) || 0
  const unpaid = totalAmount - paid

  function addProduct(product: Product) {
    // 检查是否已添加
    if (items.some((i) => i.productId === product.id)) {
      toast.error("该商品已添加")
      return
    }

    // 根据销售类型选择价格
    let defaultPrice = Number(product.costPrice)
    if (!isPurchase) {
      defaultPrice = saleType === "wholesale"
        ? Number(product.wholesalePrice)
        : Number(product.retailPrice)
    }

    const newItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: 1,
      unitPrice: defaultPrice,
      subtotal: defaultPrice,
      stock: product.stock,
    }

    setItems([...items, newItem])
    setShowSearch(false)
    setSearchText("")
  }

  function updateItem(index: number, field: "quantity" | "unitPrice", value: number) {
    const updated = items.map((item, i) => {
      if (i !== index) return item
      const newItem = { ...item, [field]: value }
      return { ...newItem, subtotal: newItem.quantity * newItem.unitPrice }
    })
    setItems(updated)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  // 切换批发/零售时自动更新价格
  const handleSaleTypeChange = useCallback((newType: "wholesale" | "retail") => {
    setSaleType(newType)
    setItems((prev) =>
      prev.map((item) => {
        const product = products.find((p) => p.id === item.productId)
        if (!product) return item
        const newPrice = newType === "wholesale"
          ? Number(product.wholesalePrice)
          : Number(product.retailPrice)
        return { ...item, unitPrice: newPrice, subtotal: item.quantity * newPrice }
      })
    )
  }, [products])

  async function handleSubmit() {
    if (isPurchase && !contactId) {
      toast.error("请选择供应商")
      return
    }
    if (items.length === 0) {
      toast.error("请添加商品")
      return
    }

    setLoading(true)
    try {
      const apiUrl = isPurchase ? "/api/purchases" : "/api/sales"
      const payload = {
        ...(isPurchase
          ? { supplierId: contactId }
          : { customerId: contactId || null, saleType }),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        paidAmount: paid,
        notes: notes.trim() || null,
      }

      const res = await api(apiUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      })

      if (res.success) {
        toast.success(`${isPurchase ? "进货" : "销售"}单创建成功`)
        router.push(isPurchase ? "/purchases" : "/sales")
      } else {
        toast.error(res.error ?? "创建失败")
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter((p) => {
    if (!searchText) return true
    return (
      p.name.includes(searchText) ||
      (p.sku && p.sku.includes(searchText))
    )
  })

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* 顶部 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>

      {/* 选择供应商/客户 + 销售类型 */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-1.5">
            <Label>{isPurchase ? "供应商" : "客户"}（{isPurchase ? "必选" : "散客可不选"}）</Label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="h-11 w-full rounded-md border px-3 text-sm"
            >
              <option value="">{isPurchase ? "请选择供应商" : "散客（不选）"}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {!isPurchase && (
            <div className="space-y-1.5">
              <Label>销售类型</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={saleType === "retail" ? "default" : "outline"}
                  className="flex-1 h-10"
                  onClick={() => handleSaleTypeChange("retail")}
                >
                  零售
                </Button>
                <Button
                  type="button"
                  variant={saleType === "wholesale" ? "default" : "outline"}
                  className="flex-1 h-10"
                  onClick={() => handleSaleTypeChange("wholesale")}
                >
                  批发
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加商品 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">商品明细</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Plus className="h-4 w-4 mr-1" />
              添加商品
            </Button>
          </div>

          {/* 商品搜索面板 */}
          {showSearch && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg space-y-2">
              <Input
                placeholder="搜索商品名称或编号..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-10"
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">没有找到商品</p>
                ) : (
                  filteredProducts.slice(0, 20).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white text-sm flex justify-between"
                      onClick={() => addProduct(p)}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        库存:{p.stock}{p.unit}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 已添加的商品列表 */}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              请点击「添加商品」选择商品
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.productId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate flex-1">{item.productName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 shrink-0"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">数量({item.unit})</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">单价(¥)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="w-20 text-right">
                      <Label className="text-xs">小计</Label>
                      <p className="h-9 leading-9 text-sm font-medium">¥{item.subtotal.toFixed(2)}</p>
                    </div>
                  </div>
                  {!isPurchase && item.stock < item.quantity && (
                    <p className="text-xs text-red-500">⚠️ 库存不足（当前:{item.stock}）</p>
                  )}
                  {index < items.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 金额 + 付款 */}
      {items.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex justify-between text-lg font-bold">
              <span>总金额</span>
              <span>¥{totalAmount.toFixed(2)}</span>
            </div>

            <div className="space-y-1.5">
              <Label>{isPurchase ? "本次付款" : "本次收款"} (¥)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={`最多 ${totalAmount.toFixed(2)}`}
                className="h-11"
              />
            </div>

            {unpaid > 0 && (
              <p className="text-sm text-orange-600">
                {isPurchase ? "本次欠供应商" : "客户本次赊账"}: ¥{unpaid.toFixed(2)}
              </p>
            )}

            <div className="space-y-1.5">
              <Label>备注</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="可选"
                className="h-11"
              />
            </div>

            <Button
              className="w-full h-12 text-base"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "提交中..." : `确认${isPurchase ? "进货" : "销售"}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
