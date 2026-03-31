"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon, Eye } from "lucide-react"
import { toast } from "sonner"

interface Warehouse {
  id: string
  name: string
  address: string | null
  contact: string | null
  phone: string | null
  isDefault: boolean
  isActive: boolean
}

export default function WarehousesPage() {
  const { isOwner } = useAuth()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const [form, setForm] = useState({ name: "", address: "", contact: "", phone: "" })
  const [submitting, setSubmitting] = useState(false)

  const fetchWarehouses = useCallback(async () => {
    const res = await api<Warehouse[]>("/api/warehouses")
    if (res.success && res.data) setWarehouses(res.data)
  }, [])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: "", address: "", contact: "", phone: "" })
    setDialogOpen(true)
  }

  const openEdit = (w: Warehouse) => {
    setEditing(w)
    setForm({ name: w.name, address: w.address || "", contact: w.contact || "", phone: w.phone || "" })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("请输入仓库名称")
    setSubmitting(true)
    try {
      if (editing) {
        const res = await api(`/api/warehouses/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        })
        if (res.success) {
          toast.success("仓库已更新")
          setDialogOpen(false)
          fetchWarehouses()
        } else {
          toast.error(res.error || "更新失败")
        }
      } else {
        const res = await api("/api/warehouses", {
          method: "POST",
          body: JSON.stringify(form),
        })
        if (res.success) {
          toast.success("仓库已创建")
          setDialogOpen(false)
          fetchWarehouses()
        } else {
          toast.error(res.error || "创建失败")
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (w: Warehouse) => {
    if (!confirm(`确定删除仓库「${w.name}」？`)) return
    const res = await api(`/api/warehouses/${w.id}`, { method: "DELETE" })
    if (res.success) {
      toast.success("仓库已删除")
      fetchWarehouses()
    } else {
      toast.error(res.error || "删除失败")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">仓库管理</h1>
          <p className="text-sm text-muted-foreground">管理仓库信息和库存分布</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新建仓库
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((w) => (
          <Card key={w.id} className={!w.isActive ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{w.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  {w.isDefault && <Badge variant="secondary">默认</Badge>}
                  {!w.isActive && <Badge variant="outline">停用</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {w.address && (
                <p className="text-sm text-muted-foreground">地址: {w.address}</p>
              )}
              {w.contact && (
                <p className="text-sm text-muted-foreground">
                  联系人: {w.contact} {w.phone && `(${w.phone})`}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Link href={`/warehouses/${w.id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    库存
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => openEdit(w)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  编辑
                </Button>
                {isOwner && !w.isDefault && (
                  <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete(w)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    删除
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 创建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑仓库" : "新建仓库"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>仓库名称 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如: 主仓库" />
            </div>
            <div className="space-y-2">
              <Label>地址</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="仓库地址" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>联系人</Label>
                <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>电话</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "提交中..." : editing ? "保存" : "创建"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
