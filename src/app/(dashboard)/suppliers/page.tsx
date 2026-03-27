"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ContactForm } from "@/components/contact-form"
import { Plus, Search, Pencil, Trash2, Phone } from "lucide-react"
import { toast } from "sonner"

interface Supplier {
  id: string
  name: string
  contact: string | null
  phone: string | null
  address: string | null
  balance: number
  notes: string | null
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editData, setEditData] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = search ? `?search=${search}` : ""
    const res = await api<Supplier[]>(`/api/suppliers${params}`)
    if (res.success && res.data) setSuppliers(res.data)
    setLoading(false)
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(item: Supplier) {
    if (!confirm(`确定要删除「${item.name}」吗？`)) return
    const res = await api(`/api/suppliers/${item.id}`, { method: "DELETE" })
    if (res.success) {
      toast.success("已删除")
      fetchData()
    } else {
      toast.error(res.error ?? "删除失败")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">供应商管理</h2>
        <Button onClick={() => { setEditData(null); setFormOpen(true) }} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          添加供应商
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索供应商名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? "没有找到符合条件的供应商" : "还没有供应商，点击上方「添加供应商」开始"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {suppliers.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium">{item.name}</span>
                      {Number(item.balance) > 0 && (
                        <span className="text-xs text-red-500 font-medium">
                          欠 ¥{Number(item.balance).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {item.contact && <span>联系人: {item.contact}</span>}
                      {item.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />{item.phone}
                        </span>
                      )}
                    </div>
                    {item.address && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.address}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setEditData(item); setFormOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                      onClick={() => handleDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContactForm
        type="supplier"
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null) }}
        onSaved={fetchData}
        data={editData}
      />
    </div>
  )
}
