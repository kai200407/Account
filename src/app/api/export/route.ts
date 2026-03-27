import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { verifyToken } from "@/lib/auth"
import { apiError } from "@/lib/api-response"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
  // 支持 query param token（浏览器下载用）
  const url = new URL(request.url)
  const queryToken = url.searchParams.get("token")
  let auth = requireAuth(request)
  if (isAuthError(auth) && queryToken) {
    const payload = verifyToken(queryToken)
    if (payload) {
      auth = payload
    } else {
      return apiError("登录已过期", 401)
    }
  }
  if (isAuthError(auth)) return auth

  const type = url.searchParams.get("type") ?? ""
  const startDate = url.searchParams.get("start") ?? ""
  const endDate = url.searchParams.get("end") ?? ""

  const now = new Date()
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1)
  const end = endDate ? new Date(endDate + "T23:59:59") : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const dateFilter = { gte: start, lte: end }

  try {
    const wb = XLSX.utils.book_new()

    if (type === "sales") {
      const sales = await prisma.saleOrder.findMany({
        where: { tenantId: auth.tenantId, status: "completed", orderDate: dateFilter },
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { orderDate: "desc" },
      })

      const rows = sales.flatMap((order) =>
        order.items.map((item) => ({
          "单号": order.orderNo,
          "日期": order.orderDate.toISOString().slice(0, 10),
          "客户": order.customer?.name ?? "散客",
          "类型": order.saleType === "wholesale" ? "批发" : "零售",
          "商品": item.product.name,
          "数量": item.quantity,
          "单位": item.product.unit,
          "单价": Number(item.unitPrice),
          "小计": Number(item.subtotal),
          "成本": Number(item.costPrice) * item.quantity,
          "利润": Number(item.profit),
          "总金额": Number(order.totalAmount),
          "已收": Number(order.paidAmount),
        }))
      )

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "销售记录")
    } else if (type === "purchases") {
      const purchases = await prisma.purchaseOrder.findMany({
        where: { tenantId: auth.tenantId, status: "completed", orderDate: dateFilter },
        include: { supplier: true, items: { include: { product: true } } },
        orderBy: { orderDate: "desc" },
      })

      const rows = purchases.flatMap((order) =>
        order.items.map((item) => ({
          "单号": order.orderNo,
          "日期": order.orderDate.toISOString().slice(0, 10),
          "供应商": order.supplier.name,
          "商品": item.product.name,
          "数量": item.quantity,
          "单位": item.product.unit,
          "单价": Number(item.unitPrice),
          "小计": Number(item.subtotal),
          "总金额": Number(order.totalAmount),
          "已付": Number(order.paidAmount),
        }))
      )

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "进货记录")
    } else if (type === "receivable") {
      const customers = await prisma.customer.findMany({
        where: { tenantId: auth.tenantId, isActive: true, balance: { gt: 0 } },
        orderBy: { balance: "desc" },
      })

      const rows = customers.map((c) => ({
        "客户名": c.name,
        "类型": c.customerType === "wholesale" ? "批发" : "零售",
        "电话": c.phone ?? "",
        "欠款金额": Number(c.balance),
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "应收款明细")
    } else if (type === "payable") {
      const suppliers = await prisma.supplier.findMany({
        where: { tenantId: auth.tenantId, isActive: true, balance: { gt: 0 } },
        orderBy: { balance: "desc" },
      })

      const rows = suppliers.map((s) => ({
        "供应商": s.name,
        "联系人": s.contact ?? "",
        "电话": s.phone ?? "",
        "欠款金额": Number(s.balance),
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, "应付款明细")
    } else {
      return apiError("请指定导出类型: sales/purchases/receivable/payable")
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const filename = `${type}_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("导出失败:", error)
    return apiError("导出失败", 500)
  }
}
