"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

interface Contact {
  id: string
  name: string
  balance: number
}

interface StatementLine {
  date: string
  docNo: string
  type: "purchase" | "payment" | "sale" | "receipt" | "return"
  summary: string
  debit: number
  credit: number
  balance: number
}

interface StatementData {
  contactName: string
  startDate: string
  endDate: string
  openingBalance: number
  periodDebit: number
  periodCredit: number
  closingBalance: number
  lines: StatementLine[]
}

const typeLabels: Record<string, string> = {
  purchase: "进货",
  payment: "付款",
  sale: "销售",
  receipt: "收款",
  return: "退货",
}

export default function StatementsPage() {
  const searchParams = useSearchParams()
  const [stmtType, setStmtType] = useState<"supplier" | "customer">(
    (searchParams.get("type") as "supplier" | "customer") ?? "supplier"
  )
  const [contactId, setContactId] = useState(searchParams.get("id") ?? "")
  const [startDate, setStartDate] = useState(searchParams.get("startDate") ?? "")
  const [endDate, setEndDate] = useState(searchParams.get("endDate") ?? "")

  const [contacts, setContacts] = useState<Contact[]>([])
  const [statement, setStatement] = useState<StatementData | null>(null)
  const [loading, setLoading] = useState(false)

  // 默认日期：本月（仅当 URL 中没有指定时）
  useEffect(() => {
    if (!startDate && !endDate) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      setStartDate(firstDay.toISOString().slice(0, 10))
      setEndDate(now.toISOString().slice(0, 10))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 加载供应商/客户列表
  const fetchContacts = useCallback(async (type: "supplier" | "customer") => {
    const endpoint = type === "supplier" ? "/api/suppliers" : "/api/customers"
    const res = await api<Contact[]>(endpoint)
    if (res.success && res.data) {
      setContacts(res.data)
    }
  }, [])

  useEffect(() => {
    setContactId("")
    setStatement(null)
    fetchContacts(stmtType)
  }, [stmtType, fetchContacts])

  // URL 参数齐全时自动查询
  useEffect(() => {
    const urlType = searchParams.get("type")
    const urlId = searchParams.get("id")
    const urlStart = searchParams.get("startDate")
    const urlEnd = searchParams.get("endDate")
    if (urlType && urlId && urlStart && urlEnd && contacts.length > 0) {
      const doAutoQuery = async () => {
        setLoading(true)
        try {
          const res = await api<StatementData>(
            `/api/statements?type=${urlType}&id=${urlId}&startDate=${urlStart}&endDate=${urlEnd}`
          )
          if (res.success && res.data) {
            setStatement(res.data)
          }
        } finally {
          setLoading(false)
        }
      }
      doAutoQuery()
    }
  }, [searchParams, contacts]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleQuery() {
    if (!contactId) {
      toast.error("请选择供应商或客户")
      return
    }
    if (!startDate || !endDate) {
      toast.error("请选择日期范围")
      return
    }

    setLoading(true)
    try {
      const res = await api<StatementData>(
        `/api/statements?type=${stmtType}&id=${contactId}&startDate=${startDate}&endDate=${endDate}`
      )
      if (res.success && res.data) {
        setStatement(res.data)
      } else {
        toast.error(res.error ?? "查询失败")
      }
    } finally {
      setLoading(false)
    }
  }

  function handleExportExcel() {
    if (!statement) return

    const debitLabel = stmtType === "supplier" ? "应付" : "应收"
    const creditLabel = stmtType === "supplier" ? "实付" : "实收"

    const header = `日期,单据号,摘要,${debitLabel},${creditLabel},余额`
    const rows = statement.lines.map(
      (l) => `${l.date},${l.docNo},${l.summary},${l.debit},${l.credit},${l.balance}`
    )

    const summaryRows = [
      `,,期初余额,,,${statement.openingBalance}`,
      `,,本期${debitLabel}合计,${statement.periodDebit},,`,
      `,,本期${creditLabel}合计,,${statement.periodCredit},`,
      `,,期末余额,,,${statement.closingBalance}`,
    ]

    const csv = "\uFEFF" + [header, ...rows, "", ...summaryRows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${statement.contactName}_对账单_${statement.startDate}_${statement.endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("导出成功")
  }

  function handleShareLink() {
    if (!statement) return
    const params = new URLSearchParams({
      type: stmtType,
      id: contactId,
      startDate,
      endDate,
    })
    const shareUrl = `${window.location.origin}/statements?${params.toString()}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("分享链接已复制到剪贴板")
    })
  }

  const debitLabel = stmtType === "supplier" ? "应付" : "应收"
  const creditLabel = stmtType === "supplier" ? "实付" : "实收"

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">对账单</h2>

      {/* 筛选条件 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>对账类型</Label>
              <Select
                value={stmtType}
                onValueChange={(v) => setStmtType(v as "supplier" | "customer")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">供应商</SelectItem>
                  <SelectItem value="customer">客户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{stmtType === "supplier" ? "供应商" : "客户"}</Label>
              <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={`选择${stmtType === "supplier" ? "供应商" : "客户"}`} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleQuery} disabled={loading} className="w-full sm:w-auto">
            {loading ? "查询中..." : "查询"}
          </Button>
        </CardContent>
      </Card>

      {/* 对账结果 */}
      {statement && (
        <>
          {/* 汇总卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">期初余额</p>
                <p className={`text-lg font-bold ${statement.openingBalance > 0 ? "text-orange-600" : statement.openingBalance < 0 ? "text-green-600" : ""}`}>
                  ¥{statement.openingBalance.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">本期{debitLabel}</p>
                <p className="text-lg font-bold text-orange-600">
                  ¥{statement.periodDebit.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">本期{creditLabel}</p>
                <p className="text-lg font-bold text-green-600">
                  ¥{statement.periodCredit.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">期末余额</p>
                <p className={`text-lg font-bold ${statement.closingBalance > 0 ? "text-orange-600" : statement.closingBalance < 0 ? "text-green-600" : ""}`}>
                  ¥{statement.closingBalance.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              导出Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareLink}>
              生成分享链接
            </Button>
          </div>

          {/* 明细表格 */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">日期</TableHead>
                      <TableHead className="w-28">单据号</TableHead>
                      <TableHead>摘要</TableHead>
                      <TableHead className="text-right w-24">{debitLabel}</TableHead>
                      <TableHead className="text-right w-24">{creditLabel}</TableHead>
                      <TableHead className="text-right w-24">余额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          本期无交易记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      statement.lines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{line.date}</TableCell>
                          <TableCell className="text-sm font-mono">{line.docNo}</TableCell>
                          <TableCell className="text-sm">
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-muted mr-1.5">
                              {typeLabels[line.type]}
                            </span>
                            {line.summary}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {line.debit > 0 ? `¥${line.debit.toFixed(2)}` : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {line.credit > 0 ? `¥${line.credit.toFixed(2)}` : ""}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${line.balance > 0 ? "text-orange-600" : line.balance < 0 ? "text-green-600" : ""}`}>
                            ¥{line.balance.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
