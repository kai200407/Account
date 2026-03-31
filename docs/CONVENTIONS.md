# 编码规范

## 文件命名
- 页面: `page.tsx`（Next.js 约定）
- API 路由: `route.ts`（Next.js 约定）
- 组件: `kebab-case.tsx`（如 `product-form.tsx`）
- 工具库: `kebab-case.ts`（如 `api-client.ts`）

## API 约定

### 请求格式
```typescript
// GET 列表（支持分页、搜索）
GET /api/products?search=xxx&categoryId=xxx&page=1&pageSize=20

// GET 详情
GET /api/products/[id]

// 创建
POST /api/products
Body: { name, sku, costPrice, ... }

// 更新
PUT /api/products/[id]
Body: { name, sku, costPrice, ... }

// 删除（软删除）
DELETE /api/products/[id]
```

### 响应格式
```typescript
// 成功
{ success: true, data: {...} }
{ success: true, data: [...], total: 100 }

// 失败
{ success: false, error: "错误信息" }
```

### 认证
- Header: `Authorization: Bearer <token>`
- 或 Query: `?token=<token>`（仅用于文件下载）

## Git 提交

### 格式
```
<type>(<scope>): <description>
```

### Type
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构（不改功能）
- `style`: 样式调整
- `docs`: 文档
- `chore`: 构建/配置

### Scope
auth, products, categories, suppliers, customers, purchases, sales, payments, reports, dashboard, export, ui, db

### 示例
```
feat(products): 添加条形码扫描录入功能
fix(sales): 修复库存扣减计算精度问题
refactor(api): 提取通用分页查询逻辑
```

## TypeScript 规范
- 严格模式，不允许 `any`（除非有充分理由）
- API 参数和返回值必须有类型定义
- Prisma 生成的类型优先使用，不要重复定义

## 测试验证清单（每次改动后）
1. `pnpm build` — 构建通过
2. 手动验证核心路径（如果改了 API，用 curl 测试）
3. 多租户隔离 — 确认 tenantId 过滤正确
4. 事务完整性 — 涉及金额/库存的操作，验证数据一致性
