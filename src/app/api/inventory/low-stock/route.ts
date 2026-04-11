import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

// 查询低库存预警商品（stock < lowStockAlert）
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    // Prisma 不支持字段间比较，使用 rawQuery 直接在 DB 层过滤
    const products = await prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; sku: string | null; stock: number; low_stock_alert: number; cost_price: number; category_id: string | null; cat_id: string | null; cat_name: string | null }>
    >(
      `SELECT p.id, p.name, p.sku, p.stock, p.low_stock_alert, p.cost_price, p.category_id,
              c.id AS cat_id, c.name AS cat_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.tenant_id = ? AND p.is_active = 1 AND p.stock < p.low_stock_alert
       ORDER BY (p.low_stock_alert - p.stock) DESC`,
      auth.tenantId
    )

    const lowStockProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      lowStockAlert: p.low_stock_alert,
      costPrice: p.cost_price,
      categoryId: p.category_id,
      category: p.cat_id ? { id: p.cat_id, name: p.cat_name } : null,
    }))

    // staff 不可见进价
    const isStaff = auth.role !== "owner"
    const items = isStaff
      ? lowStockProducts.map(({ costPrice: _, ...rest }) => rest)
      : lowStockProducts

    return apiSuccess(items)
  } catch (error) {
    console.error("查询低库存商品失败:", error)
    return apiError("查询低库存商品失败", 500)
  }
}
