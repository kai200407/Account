import { z } from 'zod'

// 登录校验
export const loginSchema = z.object({
  phone: z.string().regex(/^1\d{10}$/, '手机号格式不正确'),
  password: z.string().min(6, '密码至少6位'),
})

// 进货单校验
export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商'),
  warehouseId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive('数量必须大于0'),
    unitPrice: z.number().nonnegative('单价不能为负'),
  })).min(1, '至少需要一个商品'),
  paidAmount: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
})

// 销售单校验
export const saleOrderSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  saleType: z.enum(['retail', 'wholesale']),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive('数量必须大于0'),
    unitPrice: z.number().nonnegative('单价不能为负'),
  })).min(1, '至少需要一个商品'),
  paidAmount: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
})

// 收付款校验
export const paymentSchema = z.object({
  type: z.enum(['receivable', 'payable']),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  amount: z.number().positive('金额必须大于0'),
  method: z.enum(['cash', 'wechat', 'alipay', 'bank', 'other']),
  notes: z.string().max(500).optional(),
})
