"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Filter } from "lucide-react"

const ENTITY_LABELS: Record<string, string> = {
  product: "商品",
  sale: "销售",
  purchase: "进货",
  payment: "收付款",
  customer: "客户",
  supplier: "供应商",
  return: "退货",
  user: "员工",
}

const ACTION_LABELS: Record<string, string> = {
  create: "创建",
  update: "更新",
  delete: "删除",
  cancel: "取消",
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  cancel: "bg-yellow-100 text-yellow-800",
}

interface AuditLog {
  id: string
  userName: string
  action: string
  entity: string
  summary: string
  createdAt: string
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [entity, setEntity] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (entity) params.set("entity", entity)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)

      const res = await api(`/api/audit?${params}`)
      if (res.success && res.data) {
        const data = res.data as { items: AuditLog[]; total: number; totalPages: number }
        setLogs(data.items)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      }
    } catch {
      console.error("获取审计日志失败")
    } finally {
      setLoading(false)
    }
  }, [page, entity, startDate, endDate])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleFilter = () => {
    setPage(1)
    fetchLogs()
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const hours = String(d.getHours()).padStart(2, "0")
    const minutes = String(d.getMinutes()).padStart(2, "0")
    return `${month}-${day} ${hours}:${minutes}`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">操作日志</h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-muted-foreground mb-1 block">类型</label>
              <select
                className="w-full h-9 rounded-md border px-2 text-sm"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              >
                <option value="">全部</option>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-muted-foreground mb-1 block">开始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-muted-foreground mb-1 block">结束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>
            <Button size="sm" onClick={handleFilter} className="h-9">
              <Filter className="h-4 w-4 mr-1" />
              筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            共 {total} 条记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">加载中...</p>
          ) : logs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">暂无记录</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-2 border-b last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.userName}</span>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${ACTION_COLORS[log.action] || ""}`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {log.summary}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
