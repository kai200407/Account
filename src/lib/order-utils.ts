/**
 * 生成订单号: PO-20260327-001 / SO-20260327-001 / TF-20260327-001
 */
export function generateOrderNo(prefix: "PO" | "SO" | "TF" | "ST"): string {
  const now = new Date()
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now).replace(/-/g, "")
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")
  return `${prefix}-${date}-${rand}`
}
