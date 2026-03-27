"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ProductForm } from "@/components/product-form"
import { Plus, Search, Pencil, Trash2 } from "lucide-react"
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
  category: Category | null
}

interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  totalPages: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (categoryFilter) params.set("categoryId", categoryFilter)
    params.set("page", String(page))

    const res = await api<ProductListResponse>(`/api/products?${params}`)
    if (res.success && res.data) {
      setProducts(res.data.items)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    }
    setLoading(false)
  }, [search, categoryFilter, page])

  useEffect(() => {
    api<Category[]>("/api/categories").then((res) => {
      if (res.success && res.data) setCategories(res.data)
    })
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  async function handleDelete(product: Product) {
    if (!confirm(`确定要删除「${product.name}」吗？`)) return

    const res = await api(`/api/products/${product.id}`, { method: "DELETE" })
    if (res.success) {
      toast.success("已删除")
      fetchProducts()
    } else {
      toast.error(res.error ?? "删除失败")
    }
  }

  function handleEdit(product: Product) {
    setEditProduct(product)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditProduct(null)
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* 顶部：标题 + 添加按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">商品管理</h2>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          添加商品
        </Button>
      </div>

      {/* 搜索 + 分类筛选 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索商品名称或编号..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9 h-10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setPage(1)
          }}
          className="h-10 rounded-md border px-3 text-sm min-w-[100px]"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 商品列表 - 卡片式（手机友好） */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search || categoryFilter ? "没有找到符合条件的商品" : "还没有商品，点击上方「添加商品」开始"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  {/* 左侧：商品信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{product.name}</span>
                      {product.category && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {product.category.name}
                        </Badge>
                      )}
                    </div>

                    {product.sku && (
                      <p className="text-xs text-muted-foreground mb-1">编号: {product.sku}</p>
                    )}

                    {/* 价格行 */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span>进价: <b className="text-red-600">¥{Number(product.costPrice).toFixed(2)}</b></span>
                      <span>批发: <b className="text-blue-600">¥{Number(product.wholesalePrice).toFixed(2)}</b></span>
                      <span>零售: <b className="text-green-600">¥{Number(product.retailPrice).toFixed(2)}</b></span>
                    </div>

                    {/* 库存 */}
                    <div className="mt-1">
                      <span className={`text-xs ${product.stock <= product.lowStockAlert ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                        库存: {product.stock}{product.unit}
                        {product.stock <= product.lowStockAlert && " ⚠️ 库存不足"}
                      </span>
                    </div>
                  </div>

                  {/* 右侧：操作按钮 */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => handleDelete(product)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                共 {total} 个商品
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                <span className="text-sm leading-8">{page}/{totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 商品表单弹窗 */}
      <ProductForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditProduct(null)
        }}
        onSaved={fetchProducts}
        product={editProduct}
      />
    </div>
  )
}
