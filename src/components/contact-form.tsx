"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface ContactData {
  id?: string
  name: string
  contact?: string | null
  phone: string | null
  address: string | null
  customerType?: string
  notes: string | null
}

interface ContactFormProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  data?: ContactData | null
  type: "supplier" | "customer"
}

export function ContactForm({ open, onClose, onSaved, data, type }: ContactFormProps) {
  const isSupplier = type === "supplier"
  const label = isSupplier ? "供应商" : "客户"
  const apiPath = isSupplier ? "/api/suppliers" : "/api/customers"

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [customerType, setCustomerType] = useState("retail")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      if (data) {
        setName(data.name)
        setContact(data.contact ?? "")
        setPhone(data.phone ?? "")
        setAddress(data.address ?? "")
        setCustomerType(data.customerType ?? "retail")
        setNotes(data.notes ?? "")
      } else {
        setName("")
        setContact("")
        setPhone("")
        setAddress("")
        setCustomerType("retail")
        setNotes("")
      }
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(`请输入${label}名称`)
      return
    }

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      }

      if (isSupplier) {
        payload.contact = contact.trim() || null
      } else {
        payload.customerType = customerType
      }

      const url = data?.id ? `${apiPath}/${data.id}` : apiPath
      const method = data?.id ? "PUT" : "POST"

      const res = await api(url, { method, body: JSON.stringify(payload) })

      if (res.success) {
        toast.success(data?.id ? `${label}已更新` : `${label}已添加`)
        onSaved()
        onClose()
      } else {
        toast.error(res.error ?? "操作失败")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{data?.id ? `编辑${label}` : `添加${label}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{label}名称 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSupplier ? "例如：佛山灯具厂" : "例如：李老板"}
              className="h-11"
              required
            />
          </div>

          {isSupplier && (
            <div className="space-y-1.5">
              <Label>联系人</Label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="例如：张经理"
                className="h-11"
              />
            </div>
          )}

          {!isSupplier && (
            <div className="space-y-1.5">
              <Label>客户类型</Label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                className="h-11 w-full rounded-md border px-3 text-sm"
              >
                <option value="wholesale">批发客户</option>
                <option value="retail">零售客户</option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>电话</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号或座机"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label>地址</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="可选"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label>备注</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选"
              className="h-11"
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
