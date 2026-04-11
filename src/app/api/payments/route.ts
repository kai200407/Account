import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { logAudit } from "@/lib/audit"
import { getPaginationParams } from "@/lib/pagination"
import { paymentSchema } from "@/lib/validations"
import { validateBody } from "@/lib/validate"

// 获取收付款记录 + 应收应付汇总
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const tab = url.searchParams.get("tab") ?? "receivable"
  const { page, limit, skip } = getPaginationParams(url)

  try {
    if (tab === "summary") {
      // 汇总：所有有欠款的客户和供应商
      const [customers, suppliers] = await Promise.all([
        prisma.customer.findMany({
          where: { tenantId: auth.tenantId, isActive: true, balance: { gt: 0 } },
          orderBy: { balance: "desc" },
        }),
        prisma.supplier.findMany({
          where: { tenantId: auth.tenantId, isActive: true, balance: { gt: 0 } },
          orderBy: { balance: "desc" },
        }),
      ])

      const totalReceivable = customers.reduce((s, c) => s + Number(c.balance), 0)
      const totalPayable = suppliers.reduce((s, s2) => s + Number(s2.balance), 0)

      return apiSuccess({
        totalReceivable,
        totalPayable,
        customers,
        suppliers,
      })
    }

    // 收款或付款记录列表
    const type = tab === "payable" ? "payable" : "receivable"
    const where = { tenantId: auth.tenantId, type }

    const [records, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { customer: true, supplier: true },
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ])

    return apiSuccess({
      items: records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("获取收付款失败:", error)
    return apiError("获取收付款失败", 500)
  }
}

// 创建收款/付款（事务：记录 + 更新余额）
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const validation = validateBody(paymentSchema, body)
    if (!validation.success) {
      return apiError(validation.error, 400)
    }
    const { type, customerId, supplierId, amount, method, notes } = validation.data

    if (type === "receivable") {
      // 收款：客户还我的钱
      if (!customerId) return apiError("请选择客户")

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId: auth.tenantId },
      })
      if (!customer) return apiError("客户不存在")
      if (Number(customer.balance) <= 0) return apiError("该客户没有欠款")
      if (amount > Number(customer.balance)) {
        return apiError(`收款金额不能超过欠款 ¥${Number(customer.balance).toFixed(2)}`)
      }

      const payment = await prisma.$transaction(async (tx) => {
        const updated = await tx.customer.updateMany({
          where: {
            id: customerId,
            tenantId: auth.tenantId,
            isActive: true,
            balance: { gte: amount },
          },
          data: { balance: { decrement: amount } },
        })
        if (updated.count !== 1) {
          throw new Error("收款金额不能超过欠款")
        }

        const record = await tx.payment.create({
          data: {
            tenantId: auth.tenantId,
            type: "receivable",
            customerId,
            amount,
            method: method || "cash",
            notes: notes?.trim() || null,
          },
          include: { customer: true },
        })

        return record
      })

      await logAudit(auth, "create", "payment", payment.id, `收款 ¥${amount.toFixed(2)}，客户「${payment.customer?.name}」`)

      return apiSuccess(payment, 201)
    } else {
      // 付款：我还供应商的钱
      if (!supplierId) return apiError("请选择供应商")

      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, tenantId: auth.tenantId },
      })
      if (!supplier) return apiError("供应商不存在")
      if (Number(supplier.balance) <= 0) return apiError("不欠该供应商款项")
      if (amount > Number(supplier.balance)) {
        return apiError(`付款金额不能超过欠款 ¥${Number(supplier.balance).toFixed(2)}`)
      }

      const payment = await prisma.$transaction(async (tx) => {
        const updated = await tx.supplier.updateMany({
          where: {
            id: supplierId,
            tenantId: auth.tenantId,
            isActive: true,
            balance: { gte: amount },
          },
          data: { balance: { decrement: amount } },
        })
        if (updated.count !== 1) {
          throw new Error("付款金额不能超过欠款")
        }

        const record = await tx.payment.create({
          data: {
            tenantId: auth.tenantId,
            type: "payable",
            supplierId,
            amount,
            method: method || "cash",
            notes: notes?.trim() || null,
          },
          include: { supplier: true },
        })

        return record
      })

      await logAudit(auth, "create", "payment", payment.id, `付款 ¥${amount.toFixed(2)}，供应商「${payment.supplier?.name}」`)

      return apiSuccess(payment, 201)
    }
  } catch (error) {
    console.error("创建收付款失败:", error)
    if (error instanceof Error && error.message) {
      return apiError(error.message)
    }
    return apiError("创建收付款失败", 500)
  }
}
