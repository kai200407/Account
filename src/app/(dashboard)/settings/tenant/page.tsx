"use client"

import { useState, useEffect, useCallback } from "react"
import { api, isOwner } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Store, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface TenantInfo {
  id: string
  name: string
  createdAt: string
  memberCount: number
}

export default function TenantPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState("")
  const owner = isOwner()

  const fetchTenant = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<TenantInfo>("/api/settings/tenant")
      if (res.success && res.data) {
        setTenant(res.data)
        setEditName(res.data.name)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTenant()
  }, [fetchTenant])

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error("店铺名称不能为空")
      return
    }
    setSaving(true)
    try {
      const res = await api<TenantInfo>("/api/settings/tenant", {
        method: "PUT",
        body: JSON.stringify({ name: editName }),
      })
      if (res.success && res.data) {
        setTenant((prev) => (prev ? { ...prev, name: res.data!.name } : prev))
        toast.success("店铺名称已更新")
      } else {
        toast.error(res.error || "更新失败")
      }
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">店铺信息</h1>
        <p className="text-center py-8 text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!tenant) return null

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">店铺信息</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">店铺名称</label>
            <div className="flex gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!owner}
                placeholder="请输入店铺名称"
                className="max-w-sm"
              />
              {owner && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  保存
                </Button>
              )}
            </div>
            {!owner && (
              <p className="text-xs text-muted-foreground">仅老板可修改店铺名称</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">创建时间</p>
              <p className="text-sm">{formatDate(tenant.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">成员数量</p>
              <div className="flex items-center gap-2">
                <p className="text-sm">{tenant.memberCount} 人</p>
                <Badge variant="secondary" className="text-xs">
                  {owner ? "老板" : "员工"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
