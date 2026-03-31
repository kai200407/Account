# 项目架构

## 分层结构

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API 路由层（仅做：解析请求 → 调用 lib → 返回响应）
│   │   ├── auth/               # 认证相关
│   │   ├── products/           # 商品 CRUD
│   │   ├── categories/         # 分类
│   │   ├── suppliers/          # 供应商 CRUD
│   │   ├── customers/          # 客户 CRUD
│   │   ├── purchases/          # 进货单
│   │   ├── sales/              # 销售单
│   │   ├── payments/           # 收付款
│   │   ├── reports/            # 报表
│   │   ├── dashboard/          # 仪表板
│   │   └── export/             # Excel 导出
│   ├── (auth)/                 # 未登录页面组
│   │   └── login/page.tsx
│   ├── (dashboard)/            # 已登录页面组（自动检查登录）
│   │   ├── layout.tsx          # Dashboard 布局
│   │   ├── page.tsx            # 首页/仪表板
│   │   ├── products/
│   │   ├── suppliers/
│   │   ├── customers/
│   │   ├── purchases/
│   │   ├── sales/
│   │   ├── payments/
│   │   └── reports/
│   ├── layout.tsx              # 根布局
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui 原子组件（不要手动修改）
│   ├── auth-provider.tsx       # 登录状态管理
│   ├── sidebar.tsx             # 侧边栏 + 手机底部导航
│   ├── mobile-header.tsx       # 手机顶部栏
│   ├── product-form.tsx        # 商品表单（新建+编辑共用）
│   ├── contact-form.tsx        # 联系人表单（供应商+客户共用）
│   ├── order-form.tsx          # 订单表单（进货+销售共用）
│   └── order-list.tsx          # 订单列表（进货+销售共用）
└── lib/
    ├── prisma.ts               # Prisma 客户端单例
    ├── auth.ts                 # JWT sign/verify
    ├── api-auth.ts             # 服务端认证中间件
    ├── api-response.ts         # API 响应格式化
    ├── api-client.ts           # 前端 fetch 封装 + token 管理
    ├── order-utils.ts          # 订单相关工具函数
    └── utils.ts                # shadcn/ui cn() 工具
```

## 架构规则（Agent 必须遵守）

### 1. API 路由规则
- 所有 API **必须** 调用 `requireAuth(request)` 获取认证用户
- 所有数据查询 **必须** 加 `where: { tenantId }` 多租户隔离
- 响应统一使用 `apiSuccess()` / `apiError()`
- 错误处理统一用 `isAuthError()` 判断认证错误

### 2. 组件规则
- `components/ui/` 下的文件由 shadcn 生成，**禁止手动修改**
- 业务组件放 `components/` 根目录
- 表单组件尽量复用（如 contact-form 同时服务供应商和客户）

### 3. 数据库规则
- 新表 **必须** 有 `tenantId` 字段
- 表名用 `@@map("snake_case")`
- 字段名用 camelCase，数据库列名用 `@map("snake_case")`
- 金额字段统一用 `Decimal` 类型
- 软删除用 `isActive Boolean @default(true)`

### 4. 前端规则
- 所有 API 调用使用 `src/lib/api-client.ts` 的封装方法
- 登录状态使用 `useAuth()` hook
- Toast 使用 sonner 的 `toast.success()` / `toast.error()`
- 手机优先设计：大按钮、大输入框、少步骤

## 数据库模型关系

```
Tenant (租户/店铺)
├── User (用户，phone+password 登录)
├── Category (商品分类)
├── Product (商品，含四种价格+库存)
├── Supplier (供应商，balance=应付)
│   ├── PurchaseOrder → PurchaseOrderItem
│   └── Payment (type=payable)
├── Customer (客户，balance=应收)
│   ├── SaleOrder → SaleOrderItem
│   └── Payment (type=receivable)
└── Payment (收付款记录)
```

## 关键业务逻辑

### 进货流程（事务）
1. 创建 PurchaseOrder + PurchaseOrderItems
2. 每个商品 stock += quantity
3. 供应商 balance += (totalAmount - paidAmount)

### 销售流程（事务）
1. 检查库存充足
2. 创建 SaleOrder + SaleOrderItems
3. 每个商品 stock -= quantity
4. 每个明细 profit = (unitPrice - costPrice) * quantity
5. 客户 balance += (totalAmount - paidAmount)

### 收付款流程（事务）
1. 创建 Payment 记录
2. 收款: customer.balance -= amount
3. 付款: supplier.balance -= amount
4. 金额不能超过欠款余额
