"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Download, RefreshCw } from "lucide-react"
import { toast } from "sonner"

// ==========================================
// Types
// ==========================================

interface Category {
  id: string
  name: string
}

interface LowStockProduct {
  id: string
  name: string
  sku: string | null
  stock: number
  lowStockAlert: number
  costPrice?: number
  category: Category | null
}

// ==========================================
// Component
// ==========================================

export default function LowStockPage() {
  const { isOwner } = useAuth()
  const [products, setProducts] = useState<LowStockProduct[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLowStock = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<LowStockProduct[]>("/api/inventory/low-stock")
      if (res.success && res.data) {
        setProducts(res.data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLowStock()
  }, [fetchLowStock])

  // 导出 Excel
  function handleExport() {
    if (products.length === 0) {
      toast.error("没有数据可导出")
      return
    }

    const headers = ["商品名称", "SKU", "分类", "当前库存", "预警阈值", "差缺数量"]
    if (isOwner) headers.push("进价")

    const rows = products.map((p) => {
      const row = [
        p.name,
        p.sku ?? "",
        p.category?.name ?? "",
        p.stock,
        p.lowStockAlert,
        p.lowStockAlert - p.stock,
      ]
      if (isOwner) row.push(p.costPrice != null ? Number(p.costPrice).toFixed(2) : "")
      return row.join("\t")
    })

    // BOM + 换行符确保中文 Excel 正确显示
    const bom = "\uFEFF"
    const csv = bom + [headers.join("\t"), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `低库存预警_${new Date().toLocaleDateString("zh-CN")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("导出成功")
  }

  // 统计
  const outOfStock = products.filter((p) => p.stock === 0).length
  const nearEmpty = products.filter((p) => p.stock > 0).length

  return (
    <div className="space-y-4">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            库存预警
          </h2>
          <p className="text-sm text-muted-foreground">
            当前库存低于预警阈值的商品
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLowStock} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button size="sm" onClick={handleExport} disabled={loading || products.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">预警商品</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">缺货</p>
            <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">即将缺货</p>
            <p className="text-2xl font-bold text-amber-600">{nearEmpty}</p>
          </CardContent>
        </Card>
      </div>

      {/* 表格（桌面端）/ 卡片列表（手机端） */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            所有商品库存充足，无需预警
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 桌面端表格 */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品名称</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead className="text-right">当前库存</TableHead>
                    <TableHead className="text-right">预警阈值</TableHead>
                    <TableHead className="text-right">差缺数量</TableHead>
                    {isOwner && <TableHead className="text-right">进价</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                      <TableCell>
                        {p.category ? (
                          <Badge variant="secondary">{p.category.name}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.stock === 0 ? (
                          <Badge variant="destructive">缺货</Badge>
                        ) : (
                          <span className="text-red-600 font-medium">{p.stock}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.lowStockAlert}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-red-600 font-medium">
                          +{p.lowStockAlert - p.stock}
                        </span>
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          {p.costPrice != null ? `¥${Number(p.costPrice).toFixed(2)}` : "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 手机端卡片列表 */}
          <div className="md:hidden space-y-2">
            {products.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium truncate mr-2">{p.name}</span>
                    {p.stock === 0 ? (
                      <Badge variant="destructive">缺货</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-amber-700 bg-amber-50">
                        库存不足
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-sm">
                    {p.sku && (
                      <>
                        <span className="text-muted-foreground">SKU</span>
                        <span>{p.sku}</span>
                      </>
                    )}
                    {p.category && (
                      <>
                        <span className="text-muted-foreground">分类</span>
                        <span>{p.category.name}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">当前库存</span>
                    <span className={p.stock === 0 ? "text-red-600 font-bold" : "text-red-600"}>
                      {p.stock}
                    </span>
                    <span className="text-muted-foreground">预警阈值</span>
                    <span>{p.lowStockAlert}</span>
                    <span className="text-muted-foreground">差缺</span>
                    <span className="text-red-600 font-medium">+{p.lowStockAlert - p.stock}</span>
                    {isOwner && p.costPrice != null && (
                      <>
                        <span className="text-muted-foreground">进价</span>
                        <span>¥{Number(p.costPrice).toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
