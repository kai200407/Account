"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface Customer {
  id: string
  name: string
  balance: number
}

interface Supplier {
  id: string
  name: string
  balance: number
}

interface Summary {
  totalReceivable: number
  totalPayable: number
  customers: Customer[]
  suppliers: Supplier[]
}

interface PaymentRecord {
  id: string
  type: string
  amount: number
  method: string
  notes: string | null
  paymentDate: string
  customer?: { name: string } | null
  supplier?: { name: string } | null
}

const methodLabels: Record<string, string> = {
  cash: "现金",
  wechat: "微信",
  alipay: "支付宝",
  bank: "银行转账",
  other: "其他",
}

export default function PaymentsPage() {
  const [tab, setTab] = useState("summary")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 收付款弹窗
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<"receivable" | "payable">("receivable")
  const [formContactId, setFormContactId] = useState("")
  const [formContactName, setFormContactName] = useState("")
  const [formMaxAmount, setFormMaxAmount] = useState(0)
  const [formAmount, setFormAmount] = useState("")
  const [formMethod, setFormMethod] = useState("cash")
  const [formNotes, setFormNotes] = useState("")
  const [formLoading, setFormLoading] = useState(false)

  const fetchSummary = useCallback(async () => {
    const res = await api<Summary>("/api/payments?tab=summary")
    if (res.success && res.data) setSummary(res.data)
  }, [])

  const fetchRecords = useCallback(async (type: string) => {
    setLoading(true)
    const res = await api<{ items: PaymentRecord[] }>(`/api/payments?tab=${type}`)
    if (res.success && res.data) setRecords(res.data.items)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    if (tab === "receivable" || tab === "payable") {
      fetchRecords(tab)
    }
  }, [tab, fetchRecords])

  function openPayForm(
    type: "receivable" | "payable",
    contactId: string,
    contactName: string,
    maxAmount: number
  ) {
    setFormType(type)
    setFormContactId(contactId)
    setFormContactName(contactName)
    setFormMaxAmount(maxAmount)
    setFormAmount("")
    setFormMethod("cash")
    setFormNotes("")
    setFormOpen(true)
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(formAmount)
    if (!amt || amt <= 0) {
      toast.error("请输入金额")
      return
    }
    if (amt > formMaxAmount) {
      toast.error("金额不能超过欠款上限")
      return
    }

    setFormLoading(true)
    try {
      const payload: Record<string, unknown> = {
        type: formType,
        amount: amt,
        method: formMethod,
        notes: formNotes.trim() || null,
      }
      if (formType === "receivable") {
        payload.customerId = formContactId
      } else {
        payload.supplierId = formContactId
      }

      const res = await api("/api/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      if (res.success) {
        toast.success(formType === "receivable" ? "收款成功" : "付款成功")
        setFormOpen(false)
        fetchSummary()
        if (tab === formType) fetchRecords(tab)
      } else {
        toast.error(res.error ?? "操作失败")
      }
    } finally {
      setFormLoading(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">收付款管理</h2>

      {/* 汇总卡片 */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">客户欠款</p>
              <p className="text-xl font-bold text-orange-600">
                ¥{summary.totalReceivable.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">{summary.customers.length} 个客户</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">供应商欠款</p>
              <p className="text-xl font-bold text-red-600">
                ¥{summary.totalPayable.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">{summary.suppliers.length} 个供应商</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="summary" className="flex-1">欠款明细</TabsTrigger>
          <TabsTrigger value="receivable" className="flex-1">收款记录</TabsTrigger>
          <TabsTrigger value="payable" className="flex-1">付款记录</TabsTrigger>
        </TabsList>

        {/* 欠款明细 */}
        <TabsContent value="summary" className="space-y-4">
          {summary && (
            <>
              {summary.customers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">客户欠款</h3>
                  {summary.customers.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium">{c.name}</span>
                          <span className="text-orange-600 ml-2 font-medium">
                            ¥{Number(c.balance).toFixed(2)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openPayForm("receivable", c.id, c.name, Number(c.balance))}
                        >
                          收款
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {summary.suppliers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">供应商欠款</h3>
                  {summary.suppliers.map((s) => (
                    <Card key={s.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-red-600 ml-2 font-medium">
                            ¥{Number(s.balance).toFixed(2)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPayForm("payable", s.id, s.name, Number(s.balance))}
                        >
                          付款
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {summary.customers.length === 0 && summary.suppliers.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    没有欠款记录 🎉
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* 收款记录 */}
        <TabsContent value="receivable" className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                暂无收款记录
              </CardContent>
            </Card>
          ) : (
            records.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.customer?.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {methodLabels[r.method] ?? r.method}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(r.paymentDate)}</p>
                    {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                  </div>
                  <span className="text-green-600 font-bold">+¥{Number(r.amount).toFixed(2)}</span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* 付款记录 */}
        <TabsContent value="payable" className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                暂无付款记录
              </CardContent>
            </Card>
          ) : (
            records.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.supplier?.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {methodLabels[r.method] ?? r.method}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(r.paymentDate)}</p>
                    {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                  </div>
                  <span className="text-red-600 font-bold">-¥{Number(r.amount).toFixed(2)}</span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* 收付款弹窗 */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {formType === "receivable" ? "收款" : "付款"} - {formContactName}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handlePay} className="space-y-4">
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">
                {formType === "receivable" ? "客户欠款" : "应付金额"}
              </p>
              <p className="text-2xl font-bold text-orange-600">
                ¥{formMaxAmount.toFixed(2)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>本次{formType === "receivable" ? "收款" : "付款"}金额 (¥)</Label>
              <Input
                type="number"
                step="0.01"
                min={0.01}
                max={formMaxAmount}
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder={`最多 ${formMaxAmount.toFixed(2)}`}
                className="h-11 text-lg text-center"
                autoFocus
                required
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setFormAmount(String(formMaxAmount))}
              >
                全部{formType === "receivable" ? "收回" : "付清"}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>支付方式</Label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(methodLabels).slice(0, 5).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={formMethod === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormMethod(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>备注</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="可选"
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={formLoading}>
              {formLoading ? "处理中..." : `确认${formType === "receivable" ? "收款" : "付款"}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
