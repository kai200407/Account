import { prisma } from "@/lib/prisma"
import type { JwtPayload } from "@/lib/auth"

export type AuditAction = "create" | "update" | "delete" | "cancel"
export type AuditEntity =
  | "product"
  | "sale"
  | "purchase"
  | "payment"
  | "customer"
  | "supplier"
  | "return"
  | "user"
  | "warehouse"
  | "stock_adjustment"

/**
 * 记录审计日志
 * 在每个 CUD 操作成功后调用
 */
export async function logAudit(
  user: JwtPayload,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string | null,
  summary: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        userName: user.userName || "未知用户",
        action,
        entity,
        entityId,
        summary,
      },
    })
  } catch (error) {
    // 审计日志写入失败不应影响业务操作
    console.error("审计日志写入失败:", error)
  }
}
