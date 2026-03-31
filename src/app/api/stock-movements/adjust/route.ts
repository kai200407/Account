import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireOwner, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"
import { createStockMovement } from "@/lib/stock"
import { logAudit } from "@/lib/audit"

// 手动库存调整 — 仅 owner
export async function POST(request: NextRequest) {
  const auth = await requireOwner(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { productId, quantity, notes } = body

    if (!productId) return apiError("请选择商品")
    if (quantity === undefined || quantity === 0) return apiError("调整数量不能为0")
    if (!notes?.trim()) return apiError("请填写调整原因")

    // 验证商品属于当前租户
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: auth.tenantId },
    })
    if (!product) return apiError("商品不存在", 404)

    const adjustQty = parseInt(quantity)
    if (isNaN(adjustQty) || adjustQty === 0) return apiError("调整数量无效")

    const movement = await prisma.$transaction(async (tx) => {
      return createStockMovement(tx, {
        tenantId: auth.tenantId,
        productId,
        type: "adjustment",
        quantity: adjustQty,
        refType: "manual",
        notes: notes.trim(),
        operatorId: auth.userId,
        operatorName: auth.userName || "未知用户",
      })
    })

    await logAudit(
      auth,
      "create",
      "stock_adjustment",
      movement.id,
      `手动调整「${product.name}」库存 ${adjustQty > 0 ? "+" : ""}${adjustQty}，原因: ${notes.trim()}`
    )

    return apiSuccess(movement, 201)
  } catch (error) {
    console.error("库存调整失败:", error)
    return apiError("库存调整失败", 500)
  }
}
