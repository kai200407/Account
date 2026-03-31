"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Warehouse {
  id: string
  name: string
  isDefault: boolean
}

interface WarehouseSelectorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function WarehouseSelector({ value, onChange, className }: WarehouseSelectorProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  useEffect(() => {
    api<Warehouse[]>("/api/warehouses").then((res) => {
      if (res.success && res.data) {
        setWarehouses(res.data)
        // 自动选中默认仓库
        if (!value) {
          const def = res.data.find((w) => w.isDefault)
          if (def) onChange(def.id)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="选择仓库" />
      </SelectTrigger>
      <SelectContent>
        {warehouses.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}{w.isDefault ? "（默认）" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
