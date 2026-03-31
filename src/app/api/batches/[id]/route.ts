import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取批次详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const batch = await prisma.batch.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { product: { select: { id: true, name: true, unit: true } } },
    })
    if (!batch) return apiError("批次不存在", 404)
    return apiSuccess(batch)
  } catch (error) {
    console.error("获取批次失败:", error)
    return apiError("获取批次失败", 500)
  }
}

// 更新批次（修改数量、备注等）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth
  const { id } = await params

  try {
    const body = await request.json()
    const batch = await prisma.batch.findFirst({
      where: { id, tenantId: auth.tenantId },
    })
    if (!batch) return apiError("批次不存在", 404)

    const nextQuantity = body.quantity !== undefined ? Number(body.quantity) : batch.quantity
    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
      return apiError("批次数量必须是大于等于0的整数")
    }

    const delta = nextQuantity - batch.quantity

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.batch.update({
        where: { id },
        data: {
          ...(body.quantity !== undefined ? { quantity: nextQuantity } : {}),
          ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null } : {}),
          ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
        },
        include: { product: { select: { id: true, name: true, unit: true } } },
      })

      if (delta !== 0) {
        await createStockMovement(tx, {
          tenantId: auth.tenantId,
          productId: batch.productId,
          type: "adjustment",
          quantity: delta,
          refType: "manual",
          refId: batch.id,
          refNo: batch.batchNo,
          notes: `批次数量调整 ${batch.batchNo}: ${batch.quantity} -> ${nextQuantity}`,
          operatorId: auth.userId,
          operatorName: auth.userName || "未知用户",
        })
      }

      return saved
    })

    await logAudit(auth, "update", "warehouse", id,
      `更新批次 ${batch.batchNo}${delta !== 0 ? `，数量 ${batch.quantity}→${nextQuantity}` : ""}`)

    return apiSuccess(updated)
  } catch (error) {
    console.error("更新批次失败:", error)
    return apiError("更新批次失败", 500)
  }
}
