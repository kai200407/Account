"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, KeyRound, UserCheck, UserX } from "lucide-react"
import { toast } from "sonner"
import { StaffForm } from "@/components/staff-form"
import Link from "next/link"

interface StaffUser {
  id: string
  name: string
  phone: string
  role: string
  isActive: boolean
  createdAt: string
}

export default function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api("/api/users")
      if (res.success && res.data) {
        setUsers(res.data as StaffUser[])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const toggleActive = async (user: StaffUser) => {
    const action = user.isActive ? "禁用" : "启用"
    if (!confirm(`确定${action}员工「${user.name}」？`)) return

    const res = await api(`/api/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive: !user.isActive }),
    })

    if (res.success) {
      toast.success(`已${action}`)
      fetchUsers()
    } else {
      toast.error(res.error || `${action}失败`)
    }
  }

  const resetPassword = async (user: StaffUser) => {
    const newPwd = prompt(`重置「${user.name}」的密码为：`, "123456")
    if (!newPwd) return

    const res = await api(`/api/users/${user.id}`, {
      method: "POST",
      body: JSON.stringify({ password: newPwd }),
    })

    if (res.success) {
      toast.success("密码已重置")
    } else {
      toast.error(res.error || "重置失败")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">员工管理</h1>
        <div className="flex gap-2">
          <Link href="/settings/audit">
            <Button variant="outline" size="sm">操作日志</Button>
          </Link>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            添加员工
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            共 {users.length} 位成员
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">加载中...</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    !user.isActive ? "opacity-50 bg-gray-50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      <Badge variant={user.role === "owner" ? "default" : "secondary"}>
                        {user.role === "owner" ? "老板" : "员工"}
                      </Badge>
                      {!user.isActive && (
                        <Badge variant="destructive" className="text-xs">已禁用</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.phone}</p>
                  </div>

                  {user.role !== "owner" && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetPassword(user)}
                        title="重置密码"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(user)}
                        title={user.isActive ? "禁用" : "启用"}
                      >
                        {user.isActive ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StaffForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchUsers}
      />
    </div>
  )
}
