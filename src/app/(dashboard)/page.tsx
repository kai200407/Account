"use client"

import { useState, useEffect } from "react"
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
} from "lucide-react"
import Link from "next/link"

interface DashboardData {
  todayRevenue: number
  todayProfit: number
  todayOrders: number
  todayPurchaseTotal: number
  lowStockCount: number
  lowStockProducts: Array<{ name: string; stock: number; unit: string }>
  totalReceivable: number
  totalPayable: number
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
  const { user, isOwner } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then((res) => {
      if (res.success && res.data) setData(res.data)
    })
  }, [])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    })
  }

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

      {/* 今日概览 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">今日概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 text-center ${isOwner ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
            <div>
              <p className="text-2xl font-bold">¥{data?.todayRevenue.toFixed(0) ?? "0"}</p>
              <p className="text-xs text-muted-foreground">今日销售</p>
            </div>
            {isOwner && (
              <div>
                <p className="text-2xl font-bold text-green-600">¥{data?.todayProfit.toFixed(0) ?? "0"}</p>
                <p className="text-xs text-muted-foreground">今日利润</p>
              </div>
            )}
            <div>
              <p className="text-2xl font-bold">{data?.todayOrders ?? 0}</p>
              <p className="text-xs text-muted-foreground">今日订单</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${(data?.lowStockCount ?? 0) > 0 ? "text-red-500" : ""}`}>
                {data?.lowStockCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">低库存商品</p>
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
              库存预警
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.lowStockProducts.map((p, i) => (
                <div key={i} className="px-3 py-2 flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="text-red-500 font-medium">{p.stock}{p.unit}</span>
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
                    <p className="text-xs text-muted-foreground">{formatDate(s.orderDate)}</p>
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
