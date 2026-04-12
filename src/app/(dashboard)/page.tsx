"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  ShoppingCart,
  Truck,
  Wallet,
  AlertTriangle,
  Zap,
  Clock,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface PopularProduct {
  id: string
  name: string
  retailPrice: number
  imageUrl: string | null
}

interface LowStockProduct {
  name: string
  stock: number
  unit: string
  lowStockAlert: number
}

interface DashboardData {
  todayRevenue: number
  todayProfit: number
  todayOrders: number
  todayPurchaseTotal: number
  lowStockCount: number
  lowStockProducts: LowStockProduct[]
  totalStockValue: number
  expiringBatchCount: number
  totalReceivable: number
  totalPayable: number
  popularProducts: PopularProduct[]
  recentSales: Array<{
    id: string
    orderNo: string
    customerName: string
    totalAmount: number
    profit: number
    saleType: string
    orderDate: string
  }>
}

const quickActions = [
  { href: "/sales/new", label: "新建销售", icon: ShoppingCart, color: "text-green-600 bg-green-50" },
  { href: "/purchases/new", label: "新建进货", icon: Truck, color: "text-blue-600 bg-blue-50" },
  { href: "/products", label: "管理商品", icon: Package, color: "text-purple-600 bg-purple-50" },
  { href: "/payments", label: "收付款", icon: Wallet, color: "text-orange-600 bg-orange-50" },
]

export default function DashboardPage() {
  const router = useRouter()
  const { user, isOwner } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then((res) => {
      if (res.success && res.data) setData(res.data)
    })
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">你好，{user?.name}</h2>
        <p className="text-sm text-muted-foreground">{user?.shopName}</p>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link key={action.href} href={action.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`p-2.5 rounded-lg ${action.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="font-medium text-sm">{action.label}</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* 快速开单 — 热门商品 */}
      {data && data.popularProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              快速开单
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {data.popularProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => router.push(`/sales/new?productId=${product.id}`)}
                  className="flex flex-col items-center p-2 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden mb-1">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-400">
                          {product.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-center leading-tight line-clamp-1 w-full">
                    {product.name}
                  </span>
                  <span className="text-xs text-primary font-bold">
                    ¥{product.retailPrice.toFixed(0)}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 库存统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <Link href={data && data.lowStockCount > 0 ? "/inventory/low-stock" : "#"}>
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${(data?.lowStockCount ?? 0) > 0 ? "border-red-300 bg-red-50/50" : ""}`}>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertTriangle className={`h-4 w-4 ${(data?.lowStockCount ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                <p className="text-xs text-muted-foreground">库存预警</p>
              </div>
              <p className={`text-xl font-bold ${(data?.lowStockCount ?? 0) > 0 ? "text-red-600" : ""}`}>
                {data?.lowStockCount ?? 0}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">库存总金额</p>
            </div>
            <p className="text-lg font-bold">¥{(data?.totalStockValue ?? 0).toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className={(data?.expiringBatchCount ?? 0) > 0 ? "border-orange-300 bg-orange-50/50" : ""}>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className={`h-4 w-4 ${(data?.expiringBatchCount ?? 0) > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              <p className="text-xs text-muted-foreground">近期过期</p>
            </div>
            <p className={`text-xl font-bold ${(data?.expiringBatchCount ?? 0) > 0 ? "text-orange-600" : ""}`}>
              {data?.expiringBatchCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 今日摘要 — 精简为一行 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">今日</span>
            <div className="flex items-center gap-4">
              <span>
                销售 <b>¥{(data?.todayRevenue ?? 0).toFixed(0)}</b>
              </span>
              <span>
                <b>{data?.todayOrders ?? 0}</b> 笔
              </span>
              {isOwner && (
                <span className="text-green-600">
                  利润 <b>¥{(data?.todayProfit ?? 0).toFixed(0)}</b>
                </span>
              )}
              {(data?.lowStockCount ?? 0) > 0 && (
                <span className="text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {data?.lowStockCount}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 应收应付 */}
      {data && (data.totalReceivable > 0 || data.totalPayable > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/payments">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">客户欠款</p>
                <p className="text-lg font-bold text-orange-600">¥{data.totalReceivable.toFixed(0)}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/payments">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">供应商欠款</p>
                <p className="text-lg font-bold text-red-600">¥{data.totalPayable.toFixed(0)}</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* 低库存预警 */}
      {data && data.lowStockProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              低库存商品 Top5
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.lowStockProducts.map((p, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-medium">{p.stock}{p.unit}</span>
                    <span className="text-xs text-muted-foreground">/ 预警 {p.lowStockAlert}{p.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最近销售 */}
      {data && data.recentSales.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">最近销售</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.recentSales.map((s) => (
                <div key={s.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{s.customerName}</span>
                    <Badge variant="secondary" className="text-xs ml-1.5">
                      {s.saleType === "wholesale" ? "批发" : "零售"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">¥{s.totalAmount.toFixed(2)}</p>
                    {isOwner && (
                      <p className="text-xs text-green-600">+¥{s.profit.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
