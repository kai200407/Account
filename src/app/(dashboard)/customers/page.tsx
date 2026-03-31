"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ContactForm } from "@/components/contact-form"
import { Plus, Search, Pencil, Trash2, Phone } from "lucide-react"
import { toast } from "sonner"

interface Customer {
  id: string
  name: string
  phone: string | null
  address: string | null
  customerType: string
  balance: number
  notes: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editData, setEditData] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (typeFilter) params.set("type", typeFilter)
    const res = await api<Customer[]>(`/api/customers?${params}`)
    if (res.success && res.data) setCustomers(res.data)
    setLoading(false)
  }, [search, typeFilter])

  useEffect(() => {
    void Promise.resolve().then(() => fetchData())
  }, [fetchData])

  async function handleDelete(item: Customer) {
    if (!confirm(`确定要删除「${item.name}」吗？`)) return
    const res = await api(`/api/customers/${item.id}`, { method: "DELETE" })
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
        <h2 className="text-xl font-bold">客户管理</h2>
        <Button onClick={() => { setEditData(null); setFormOpen(true) }} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          添加客户
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索客户名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-md border px-3 text-sm"
        >
          <option value="">全部</option>
          <option value="wholesale">批发</option>
          <option value="retail">零售</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search || typeFilter ? "没有找到符合条件的客户" : "还没有客户，点击上方「添加客户」开始"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {customers.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium">{item.name}</span>
                      <Badge variant={item.customerType === "wholesale" ? "default" : "secondary"} className="text-xs">
                        {item.customerType === "wholesale" ? "批发" : "零售"}
                      </Badge>
                      {Number(item.balance) > 0 && (
                        <span className="text-xs text-orange-500 font-medium">
                          欠 ¥{Number(item.balance).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {item.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />{item.phone}
                        </span>
                      )}
                      {item.address && <span>{item.address}</span>}
                    </div>
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
        type="customer"
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null) }}
        onSaved={fetchData}
        data={editData}
      />
    </div>
  )
}
