"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api-client"
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Trash2, ArrowLeft, Star, Search, ShoppingCart, Minus, Plus, ChevronUp, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { ProductGrid } from "@/components/product-grid"
import { WarehouseSelector } from "@/components/warehouse-selector"

interface Product {
  id: string
  name: string
  sku: string | null
  unit: string
  costPrice: number
  wholesalePrice: number
  retailPrice: number
  stock: number
  imageUrl?: string | null
  category?: { name: string } | null
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

interface Contact {
  id: string
  name: string
  customerType?: string
}

interface OrderFormProps {
  type: "purchase" | "sale"
}

export function OrderForm({ type }: OrderFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPurchase = type === "purchase"
  const title = isPurchase ? "新建进货单" : "新建销售单"

  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [recentContacts, setRecentContacts] = useState<Contact[]>([])
  const [saleType, setSaleType] = useState<"wholesale" | "retail">("retail")

  // 表单
  const [contactId, setContactId] = useState("")
  const [warehouseId, setWarehouseId] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [paidAmount, setPaidAmount] = useState("")
  const [notes, setNotes] = useState("")

  // 商品搜索 & Tab
  const [searchText, setSearchText] = useState("")
  const [productTab, setProductTab] = useState<"popular" | "all">("popular")

  // 购物车展开状态
  const [cartExpanded, setCartExpanded] = useState(false)

  // 草稿自动保存
  const DRAFT_KEY = isPurchase ? "draft_purchase_new" : "draft_sale_new"
  const draftRestored = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 已添加商品的数量映射（用于网格 badge）
  const selectedQuantities: Record<string, number> = {}
  items.forEach((item) => {
    selectedQuantities[item.productId] = item.quantity
  })

  // 恢复草稿
  useEffect(() => {
    const draft = loadDraft(DRAFT_KEY)
    if (draft && !draftRestored.current) {
      draftRestored.current = true
      if (draft.contactId) setContactId(draft.contactId)
      if (draft.warehouseId) setWarehouseId(draft.warehouseId)
      if (draft.items?.length) setItems(draft.items)
      if (draft.paidAmount) setPaidAmount(draft.paidAmount)
      if (draft.notes) setNotes(draft.notes)
      if (draft.saleType) setSaleType(draft.saleType)
      toast.info("已恢复上次未提交的开单数据")
    } else {
      draftRestored.current = true
    }
  }, [DRAFT_KEY])

  // 自动保存草稿（防抖 500ms）
  useEffect(() => {
    if (!draftRestored.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (contactId || warehouseId || items.length > 0 || paidAmount || notes) {
        saveDraft(DRAFT_KEY, { contactId, warehouseId, items, paidAmount, notes, saleType })
      }
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [DRAFT_KEY, contactId, warehouseId, items, paidAmount, notes, saleType])

  useEffect(() => {
    // 加载所有商品
    api<Product[]>("/api/products?limit=200").then((res) => {
      if (res.success && res.data) {
        const list = "items" in res.data ? (res.data as unknown as { items: Product[] }).items : res.data
        setProducts(Array.isArray(list) ? list : [])
      }
    })

    // 加载常用商品
    api<{ items: Product[] }>("/api/products?sort=popular&limit=20").then((res) => {
      if (res.success && res.data) {
        const list = res.data.items ?? res.data
        setPopularProducts(Array.isArray(list) ? list : [])
      }
    })

    // 加载全部联系人
    const contactApi = isPurchase ? "/api/suppliers" : "/api/customers"
    api<Contact[]>(contactApi).then((res) => {
      if (res.success && res.data) setContacts(res.data)
    })

    // 加载最近客户
    if (!isPurchase) {
      api<Contact[]>("/api/customers?sort=recent&limit=5").then((res) => {
        if (res.success && res.data) setRecentContacts(res.data)
      })
    }
  }, [isPurchase])

  // URL 参数自动预添加商品
  useEffect(() => {
    const productId = searchParams.get("productId")
    if (productId && products.length > 0 && items.length === 0) {
      const product = products.find((p) => p.id === productId)
      if (product) {
        tapProduct(product)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, products])

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const paid = parseFloat(paidAmount) || 0
  const unpaid = totalAmount - paid

  function getDefaultPrice(product: Product): number {
    if (isPurchase) return Number(product.costPrice)
    return saleType === "wholesale"
      ? Number(product.wholesalePrice)
      : Number(product.retailPrice)
  }

  function tapProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        // 数量+1
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
            : i
        )
      }
      // 新增
      const price = getDefaultPrice(product)
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: 1,
          unitPrice: price,
          subtotal: price,
          stock: product.stock,
        },
      ]
    })
  }

  function updateItem(index: number, field: "quantity" | "unitPrice", value: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const newItem = { ...item, [field]: value }
        return { ...newItem, subtotal: newItem.quantity * newItem.unitPrice }
      })
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaleTypeChange = useCallback(
    (newType: "wholesale" | "retail") => {
      setSaleType(newType)
      setItems((prev) =>
        prev.map((item) => {
          const product = products.find((p) => p.id === item.productId)
          if (!product) return item
          const newPrice =
            newType === "wholesale"
              ? Number(product.wholesalePrice)
              : Number(product.retailPrice)
          return { ...item, unitPrice: newPrice, subtotal: item.quantity * newPrice }
        })
      )
    },
    [products]
  )

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
        warehouseId: warehouseId || null,
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
        clearDraft(DRAFT_KEY)
        toast.success(`${isPurchase ? "进货" : "销售"}单创建成功`)
        router.push(isPurchase ? "/purchases" : "/sales")
      } else {
        toast.error(res.error ?? "创建失败")
      }
    } finally {
      setLoading(false)
    }
  }

  // 过滤商品（搜索）
  const filteredProducts = searchText
    ? products.filter(
        (p) => p.name.includes(searchText) || (p.sku && p.sku.includes(searchText))
      )
    : products

  // 展示的商品列表
  const displayProducts = searchText
    ? filteredProducts
    : productTab === "popular"
      ? popularProducts
      : products

  const priceType = isPurchase ? "cost" as const : saleType

  return (
    <div className="space-y-3 max-w-lg mx-auto pb-32">
      {/* 顶部 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold flex-1">{title}</h2>
      </div>

      {/* 一行：类型切换 + 客户/供应商 */}
      <Card>
        <CardContent className="p-3 space-y-3">
          {!isPurchase && (
            <div className="flex gap-2 items-center">
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant={saleType === "retail" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSaleTypeChange("retail")}
                >
                  零售
                </Button>
                <Button
                  type="button"
                  variant={saleType === "wholesale" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSaleTypeChange("wholesale")}
                >
                  批发
                </Button>
              </div>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-9 flex-1 rounded-md border px-2 text-sm"
              >
                <option value="">散客</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 最近客户快捷选择 */}
          {!isPurchase && recentContacts.length > 0 && !contactId && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground leading-7">最近:</span>
              {recentContacts.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setContactId(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          )}

          {isPurchase && (
            <div>
              <Label>供应商 *</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-11 w-full rounded-md border px-3 text-sm mt-1"
              >
                <option value="">请选择供应商</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 仓库选择 */}
          <div>
            <Label>{isPurchase ? "入库仓库" : "出库仓库"}</Label>
            <WarehouseSelector
              value={warehouseId}
              onChange={setWarehouseId}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tab + 搜索 */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={productTab === "popular" && !searchText ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setProductTab("popular")
            setSearchText("")
          }}
        >
          <Star className="h-3 w-3 mr-1" />
          常用
        </Button>
        <Button
          type="button"
          variant={productTab === "all" && !searchText ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setProductTab("all")
            setSearchText("")
          }}
        >
          全部
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索商品..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* 商品网格 */}
      <ProductGrid
        products={displayProducts}
        onTap={(p) => {
          const fullProduct = products.find((fp) => fp.id === p.id)
          if (fullProduct) tapProduct(fullProduct)
        }}
        selectedQuantities={selectedQuantities}
        priceType={priceType}
      />

      {/* 底部悬浮购物车摘要 */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-56 bg-white border-t shadow-lg z-40">
          {/* 摘要栏 */}
          <button
            type="button"
            onClick={() => setCartExpanded(!cartExpanded)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {totalItems}件 ¥{totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary font-medium">
                {cartExpanded ? "收起" : "查看购物车"}
              </span>
              {cartExpanded ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronUp className="h-4 w-4 text-primary" />
              )}
            </div>
          </button>

          {/* 展开的购物车详情 */}
          {cartExpanded && (
            <div className="border-t px-4 pb-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2 py-3">
                {items.map((item, index) => (
                  <div key={item.productId} className="flex items-center gap-2">
                    <span className="text-sm flex-1 truncate">{item.productName}</span>

                    {/* 数量控制 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          if (item.quantity <= 1) {
                            removeItem(index)
                          } else {
                            updateItem(index, "quantity", item.quantity - 1)
                          }
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        className="h-7 w-12 text-center text-sm px-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateItem(index, "quantity", item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* 单价 */}
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="h-7 w-16 text-sm text-right px-1"
                    />

                    {/* 小计 */}
                    <span className="text-sm font-medium w-16 text-right shrink-0">
                      ¥{item.subtotal.toFixed(0)}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 shrink-0"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    {!isPurchase && item.stock < item.quantity && (
                      <span className="text-[10px] text-red-500 absolute">⚠️</span>
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              {/* 付款 + 提交 */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-3">
                  <Label className="shrink-0 text-sm">{isPurchase ? "本次付款" : "本次收款"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={totalAmount.toFixed(2)}
                    className="h-9 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setPaidAmount(totalAmount.toFixed(2))}
                  >
                    全额
                  </Button>
                </div>

                {unpaid > 0 && paid > 0 && (
                  <p className="text-sm text-orange-600">
                    {isPurchase ? "欠供应商" : "客户赊账"}: ¥{unpaid.toFixed(2)}
                  </p>
                )}

                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="备注（可选）"
                  className="h-9"
                />

                <Button
                  className="w-full h-12 text-base"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading
                    ? "提交中..."
                    : `确认${isPurchase ? "进货" : "销售"} ¥${totalAmount.toFixed(2)}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
