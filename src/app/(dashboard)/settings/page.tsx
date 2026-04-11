"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Users, ClipboardList, Store, SlidersHorizontal } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

const settingItems = [
  {
    href: "/settings/staff",
    icon: Users,
    title: "员工管理",
    description: "添加、禁用员工，重置密码",
    ownerOnly: true,
  },
  {
    href: "/settings/audit",
    icon: ClipboardList,
    title: "操作日志",
    description: "查看所有操作记录",
    ownerOnly: true,
  },
  {
    href: "/settings/tenant",
    icon: Store,
    title: "店铺信息",
    description: "修改店铺名称",
    ownerOnly: true,
  },
  {
    href: "/settings/preferences",
    icon: SlidersHorizontal,
    title: "系统偏好",
    description: "界面与功能偏好设置",
    ownerOnly: false,
  },
]

export default function SettingsPage() {
  const { isOwner } = useAuth()

  const visibleItems = isOwner
    ? settingItems
    : settingItems.filter((item) => !item.ownerOnly)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">设置</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibleItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
