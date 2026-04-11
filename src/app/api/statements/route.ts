import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export interface StatementLine {
  date: string
  docNo: string
  type: "purchase" | "payment" | "sale" | "receipt" | "return"
  summary: string
  debit: number   // 应付/应收
  credit: number  // 实付/实收
  balance: number // 累计余额
}

export interface StatementData {
  contactName: string
  startDate: string
  endDate: string
  openingBalance: number
  periodDebit: number
  periodCredit: number
  closingBalance: number
  lines: StatementLine[]
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const type = url.searchParams.get("type") // supplier | customer
  const id = url.searchParams.get("id")
  const startDate = url.searchParams.get("startDate")
  const endDate = url.searchParams.get("endDate")

  if (!type || !["supplier", "customer"].includes(type)) {
    return apiError("请指定对账类型：supplier 或 customer")
  }
  if (!id) return apiError("请选择供应商或客户")
  if (!startDate || !endDate) return apiError("请选择日期范围")

  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    if (type === "supplier") {
      return apiSuccess(await buildSupplierStatement(auth.tenantId, id, start, end))
    }
    return apiSuccess(await buildCustomerStatement(auth.tenantId, id, start, end))
  } catch (error) {
    console.error("生成对账单失败:", error)
    return apiError("生成对账单失败", 500)
  }
}

async function buildSupplierStatement(
  tenantId: string,
  supplierId: string,
  startDate: Date,
  endDate: Date
): Promise<StatementData> {
  // 验证供应商
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId, isActive: true },
  })
  if (!supplier) throw new Error("供应商不存在")

  // 期初之前的进货单
  const purchasesBefore = await prisma.purchaseOrder.findMany({
    where: {
      tenantId,
      supplierId,
      status: "completed",
      orderDate: { lt: startDate },
    },
    select: { totalAmount: true, paidAmount: true },
  })

  // 期初之前的付款记录
  const paymentsBefore = await prisma.payment.findMany({
    where: {
      tenantId,
      supplierId,
      type: "payable",
      paymentDate: { lt: startDate },
    },
    select: { amount: true },
  })

  // 期初余额 = 期初前应付 - 期初前已付
  const totalPayableBefore = purchasesBefore.reduce((s, p) => s + Number(p.totalAmount), 0)
  const totalPaidBefore = paymentsBefore.reduce((s, p) => s + Number(p.amount), 0)
  const openingBalance = totalPayableBefore - totalPaidBefore

  // 本期进货单
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId,
      supplierId,
      status: "completed",
      orderDate: { gte: startDate, lte: endDate },
    },
    orderBy: { orderDate: "asc" },
  })

  // 本期付款记录
  const payments = await prisma.payment.findMany({
    where: {
      tenantId,
      supplierId,
      type: "payable",
      paymentDate: { gte: startDate, lte: endDate },
    },
    orderBy: { paymentDate: "asc" },
  })

  // 合并并按日期排序
  const lines: StatementLine[] = []
  let runningBalance = openingBalance

  const allEvents: {
    date: Date
    sortKey: string
    docNo: string
    type: "purchase" | "payment"
    summary: string
    debit: number
    credit: number
  }[] = []

  for (const po of purchaseOrders) {
    allEvents.push({
      date: po.orderDate,
      sortKey: `${po.orderDate.toISOString()}_1_${po.orderNo}`,
      docNo: po.orderNo,
      type: "purchase",
      summary: po.notes ? `进货（${po.notes}）` : "进货",
      debit: Number(po.totalAmount),
      credit: 0,
    })
  }

  for (const pay of payments) {
    allEvents.push({
      date: pay.paymentDate,
      sortKey: `${pay.paymentDate.toISOString()}_2_${pay.id}`,
      docNo: `PAY-${pay.id.slice(-6).toUpperCase()}`,
      type: "payment",
      summary: pay.notes ? `付款（${pay.notes}）` : "付款",
      debit: 0,
      credit: Number(pay.amount),
    })
  }

  allEvents.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  for (const evt of allEvents) {
    runningBalance = runningBalance + evt.debit - evt.credit
    lines.push({
      date: evt.date.toISOString().slice(0, 10),
      docNo: evt.docNo,
      type: evt.type,
      summary: evt.summary,
      debit: evt.debit,
      credit: evt.credit,
      balance: Math.round(runningBalance * 100) / 100,
    })
  }

  const periodDebit = lines.reduce((s, l) => s + l.debit, 0)
  const periodCredit = lines.reduce((s, l) => s + l.credit, 0)

  return {
    contactName: supplier.name,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    openingBalance: Math.round(openingBalance * 100) / 100,
    periodDebit: Math.round(periodDebit * 100) / 100,
    periodCredit: Math.round(periodCredit * 100) / 100,
    closingBalance: Math.round((openingBalance + periodDebit - periodCredit) * 100) / 100,
    lines,
  }
}

async function buildCustomerStatement(
  tenantId: string,
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<StatementData> {
  // 验证客户
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, isActive: true },
  })
  if (!customer) throw new Error("客户不存在")

  // 期初之前的销售单
  const salesBefore = await prisma.saleOrder.findMany({
    where: {
      tenantId,
      customerId,
      status: "completed",
      orderDate: { lt: startDate },
    },
    select: { totalAmount: true, paidAmount: true },
  })

  // 期初之前的退货单
  const returnsBefore = await prisma.returnOrder.findMany({
    where: {
      tenantId,
      customerId,
      status: "completed",
      returnDate: { lt: startDate },
    },
    select: { totalAmount: true },
  })

  // 期初之前的收款记录
  const receiptsBefore = await prisma.payment.findMany({
    where: {
      tenantId,
      customerId,
      type: "receivable",
      paymentDate: { lt: startDate },
    },
    select: { amount: true },
  })

  // 期初余额 = 期初前应收 - 期初前已收 - 期初前退货
  const totalReceivableBefore = salesBefore.reduce((s, o) => s + Number(o.totalAmount), 0)
  const totalReceivedBefore = receiptsBefore.reduce((s, p) => s + Number(p.amount), 0)
  const totalReturnedBefore = returnsBefore.reduce((s, r) => s + Number(r.totalAmount), 0)
  const openingBalance = totalReceivableBefore - totalReceivedBefore - totalReturnedBefore

  // 本期销售单
  const saleOrders = await prisma.saleOrder.findMany({
    where: {
      tenantId,
      customerId,
      status: "completed",
      orderDate: { gte: startDate, lte: endDate },
    },
    orderBy: { orderDate: "asc" },
  })

  // 本期退货单
  const returnOrders = await prisma.returnOrder.findMany({
    where: {
      tenantId,
      customerId,
      status: "completed",
      returnDate: { gte: startDate, lte: endDate },
    },
    orderBy: { returnDate: "asc" },
  })

  // 本期收款记录
  const receipts = await prisma.payment.findMany({
    where: {
      tenantId,
      customerId,
      type: "receivable",
      paymentDate: { gte: startDate, lte: endDate },
    },
    orderBy: { paymentDate: "asc" },
  })

  // 合并并按日期排序
  const lines: StatementLine[] = []
  let runningBalance = openingBalance

  const allEvents: {
    date: Date
    sortKey: string
    docNo: string
    type: "sale" | "receipt" | "return"
    summary: string
    debit: number  // 应收
    credit: number // 实收
  }[] = []

  for (const so of saleOrders) {
    allEvents.push({
      date: so.orderDate,
      sortKey: `${so.orderDate.toISOString()}_1_${so.orderNo}`,
      docNo: so.orderNo,
      type: "sale",
      summary: so.notes ? `销售（${so.notes}）` : "销售",
      debit: Number(so.totalAmount),
      credit: 0,
    })
  }

  for (const ret of returnOrders) {
    allEvents.push({
      date: ret.returnDate,
      sortKey: `${ret.returnDate.toISOString()}_1.5_${ret.returnNo}`,
      docNo: ret.returnNo,
      type: "return",
      summary: ret.reason ? `退货（${ret.reason}）` : "退货",
      debit: 0,
      credit: Number(ret.totalAmount),
    })
  }

  for (const rcpt of receipts) {
    allEvents.push({
      date: rcpt.paymentDate,
      sortKey: `${rcpt.paymentDate.toISOString()}_2_${rcpt.id}`,
      docNo: `RCV-${rcpt.id.slice(-6).toUpperCase()}`,
      type: "receipt",
      summary: rcpt.notes ? `收款（${rcpt.notes}）` : "收款",
      debit: 0,
      credit: Number(rcpt.amount),
    })
  }

  allEvents.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  for (const evt of allEvents) {
    runningBalance = runningBalance + evt.debit - evt.credit
    lines.push({
      date: evt.date.toISOString().slice(0, 10),
      docNo: evt.docNo,
      type: evt.type,
      summary: evt.summary,
      debit: evt.debit,
      credit: evt.credit,
      balance: Math.round(runningBalance * 100) / 100,
    })
  }

  const periodDebit = lines.reduce((s, l) => s + l.debit, 0)
  const periodCredit = lines.reduce((s, l) => s + l.credit, 0)

  return {
    contactName: customer.name,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    openingBalance: Math.round(openingBalance * 100) / 100,
    periodDebit: Math.round(periodDebit * 100) / 100,
    periodCredit: Math.round(periodCredit * 100) / 100,
    closingBalance: Math.round((openingBalance + periodDebit - periodCredit) * 100) / 100,
    lines,
  }
}
