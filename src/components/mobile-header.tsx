"use client"

import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, Warehouse, FileText, Wallet, LogOut, AlertTriangle, BarChart3, Clock, RefreshCw, TrendingUp } from "lucide-react"

export function MobileHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()

  return (
    <header className="md:hidden sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
      <h1 className="text-base font-bold truncate">{user?.shopName}</h1>

      <DropdownMenu>
        <DropdownMenuTrigger className="p-1">
          <Menu className="h-6 w-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => router.push("/suppliers")}>
            <Warehouse className="h-4 w-4 mr-2" />
            供应商
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/payments")}>
            <Wallet className="h-4 w-4 mr-2" />
            收付款
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/reports")}>
            <FileText className="h-4 w-4 mr-2" />
            报表
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/inventory/low-stock")}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            库存预警
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/reports/inventory")}>
            <BarChart3 className="h-4 w-4 mr-2" />
            库存报表
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/reports/stock-age")}>
            <Clock className="h-4 w-4 mr-2" />
            库龄分析
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/reports/turnover")}>
            <RefreshCw className="h-4 w-4 mr-2" />
            周转分析
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/reports/cost-trend")}>
            <TrendingUp className="h-4 w-4 mr-2" />
            成本趋势
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/inventory/detail")}>
            <FileText className="h-4 w-4 mr-2" />
            进销存明细
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
