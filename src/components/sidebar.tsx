"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  FileText,
  Wallet,
  LogOut,
  Undo2,
  Settings,
  ClipboardList,
  Building2,
  ArrowRightLeft,
  ClipboardCheck,
  Layers,
  BarChart3,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navGroups = [
  {
    label: null,
    items: [
      { href: "/", label: "首页", icon: LayoutDashboard },
      { href: "/products", label: "商品", icon: Package },
      { href: "/sales", label: "销售", icon: ShoppingCart },
      { href: "/purchases", label: "进货", icon: Truck },
      { href: "/returns", label: "退货", icon: Undo2 },
    ],
  },
  {
    label: "库存管理",
    items: [
      { href: "/inventory", label: "库存", icon: ClipboardList },
      { href: "/warehouses", label: "仓库", icon: Warehouse },
      { href: "/transfers", label: "调拨", icon: ArrowRightLeft },
      { href: "/stocktakes", label: "盘点", icon: ClipboardCheck },
      { href: "/batches", label: "批次", icon: Layers },
      { href: "/inventory/low-stock", label: "库存预警", icon: AlertTriangle },
      { href: "/inventory/detail", label: "进销存明细", icon: FileText },
    ],
  },
  {
    label: "财务",
    items: [
      { href: "/customers", label: "客户", icon: Users },
      { href: "/suppliers", label: "供应商", icon: Building2 },
      { href: "/payments", label: "收付款", icon: Wallet },
      { href: "/statements", label: "对账", icon: FileSpreadsheet },
    ],
  },
  {
    label: "报表",
    items: [
      { href: "/analytics", label: "分析", icon: BarChart3 },
      { href: "/reports", label: "报表", icon: FileText },
      { href: "/reports/inventory", label: "库存报表", icon: BarChart3 },
      { href: "/reports/stock-age", label: "库龄分析", icon: Clock },
      { href: "/reports/turnover", label: "周转分析", icon: RefreshCw },
      { href: "/reports/cost-trend", label: "成本趋势", icon: TrendingUp },
    ],
  },
]

// owner 专属导航
const ownerNavItems = [
  { href: "/settings", label: "设置", icon: Settings },
]

// 手机底部只显示最常用的5个
const flatNavItems = navGroups.flatMap((g) => g.items)
const mobileNavItems = flatNavItems.slice(0, 5)

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout, isOwner } = useAuth()

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-white border-r">
      {/* 店铺名 */}
      <div className="p-4">
        <h1 className="text-lg font-bold truncate">{user?.shopName}</h1>
        <p className="text-xs text-muted-foreground truncate">{user?.name}</p>
      </div>

      <Separator />

      {/* 导航 */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
        {isOwner && (
          <div>
            <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
              管理
            </div>
            {ownerNavItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* 退出 */}
      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          退出登录
        </Button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="flex justify-around py-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 text-xs ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
