"use client"

import { useState } from "react"
import { api } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface StaffFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function StaffForm({ open, onClose, onSuccess }: StaffFormProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("请输入姓名")
    if (!phone.trim()) return toast.error("请输入手机号")

    setLoading(true)
    try {
      const res = await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          password: password.trim() || "123456",
        }),
      })

      if (res.success) {
        toast.success("员工创建成功")
        setName("")
        setPhone("")
        setPassword("")
        onSuccess()
        onClose()
      } else {
        toast.error(res.error || "创建失败")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加员工</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>姓名 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="员工姓名"
            />
          </div>
          <div>
            <Label>手机号 *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="用于登录"
              type="tel"
            />
          </div>
          <div>
            <Label>初始密码</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="默认 123456"
            />
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "创建中..." : "创建员工"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
