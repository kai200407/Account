# 记账系统 - 开发进度文档

> 每个 Block 完成后更新此文档，防止上下文清空后丢失进度。

## 项目概况

| 项目 | 详情 |
|------|------|
| **项目名** | jizhang（记账系统） |
| **路径** | /Users/arden/Desktop/jizhang |
| **技术栈** | Next.js 15 + Prisma 6 + SQLite(开发) + TailwindCSS |
| **部署目标** | 香港云服务器 16核+16GB，部署时切换 PostgreSQL |
| **用户数** | 7人同时使用（多个家庭/店铺） |
| **业务** | 电疗灯具、厨房卫浴批发+零售 |

## 核心需求

- 多租户：每家店铺数据完全独立
- 商品管理：进价、批发价、零售价、特殊价
- 库存管理：进货自动增加、销售自动减少
- 销售/进货记录
- 应收应付（双向赊账）
- 报表统计（日/月利润、畅销/滞销、客户统计）
- Excel 导出
- 自动数据备份
- 中文界面、手机+电脑响应式

## 技术决策

- Prisma 6（非 7，因为 7 对 SQLite 本地开发需要 adapter 配置复杂）
- 开发用 SQLite，部署切 PostgreSQL（只改 .env 和 schema provider）
- `prisma-client-js` generator（Prisma 6 标准）
- bcryptjs 加密密码，jsonwebtoken 做 JWT
- shadcn/ui 组件库（待安装）

## 数据库表结构

```
tenants          → 租户（店铺）
users            → 用户（phone+password 登录，role: owner|staff）
categories       → 商品分类（电疗灯具、厨房、卫浴、其他）
products         → 商品（name, sku, costPrice, wholesalePrice, retailPrice, specialPrice, stock）
suppliers        → 供应商（name, contact, phone, balance=应付余额）
customers        → 客户（name, phone, customerType=wholesale|retail, balance=应收余额）
purchase_orders  → 进货单（supplier, totalAmount, paidAmount, status）
purchase_order_items → 进货明细（product, quantity, unitPrice, subtotal）
sale_orders      → 销售单（customer, saleType=wholesale|retail, totalAmount, paidAmount, profit）
sale_order_items → 销售明细（product, quantity, unitPrice, costPrice快照, subtotal, profit）
payments         → 收付款记录（type=receivable|payable, amount, method）
```

## 关键文件

```
prisma/schema.prisma     → 数据库模型定义（Prisma 6, prisma-client-js）
prisma/seed.ts           → 种子数据（示例租户+用户+商品）
src/lib/prisma.ts        → Prisma 客户端单例
src/lib/auth.ts          → JWT sign/verify（7天有效期）
src/lib/api-auth.ts      → 服务端认证中间件（requireAuth/isAuthError）
src/lib/api-response.ts  → API 响应格式化（apiSuccess/apiError）
src/lib/api-client.ts    → 前端 fetch 封装 + token 管理
src/lib/utils.ts         → shadcn/ui 工具函数（cn）
src/components/auth-provider.tsx  → AuthProvider（登录状态）
src/components/sidebar.tsx        → 侧边栏 + 手机底部导航
src/components/mobile-header.tsx  → 手机顶部栏
src/app/layout.tsx                → 根布局（AuthProvider + Toaster）
src/app/(auth)/login/page.tsx     → 登录/注册页
src/app/(dashboard)/layout.tsx    → Dashboard 布局（检查登录）
src/app/(dashboard)/page.tsx      → Dashboard 首页
src/app/api/auth/register/route.ts → 注册 API
src/app/api/auth/login/route.ts    → 登录 API
src/app/api/auth/me/route.ts      → 获取当前用户 API
.env                     → DATABASE_URL, JWT_SECRET
docker-compose.yml       → 生产环境 PostgreSQL 配置
```

## 测试账号

- 手机号: 13800138000
- 密码: 123456
- 租户: 示例店铺
- 角色: owner

---

## Block 完成记录

### ✅ Block 1: 项目初始化 + 数据库（已完成）
- [x] Next.js 15 项目创建（pnpm, TypeScript, TailwindCSS, App Router, src目录）
- [x] Prisma 6 + SQLite 配置
- [x] 11张数据库表迁移成功
- [x] 种子数据：1租户 + 1用户 + 4分类 + 3商品 + 1供应商 + 1客户
- [x] `pnpm build` 构建通过

### ✅ Block 2: 认证系统 + 多租户（已完成）
- [x] JWT 工具函数 `src/lib/auth.ts`（sign/verify，7天有效期）
- [x] API 响应工具 `src/lib/api-response.ts`（apiSuccess/apiError）
- [x] 认证中间件 `src/lib/api-auth.ts`（getAuthUser/requireAuth/isAuthError）
- [x] 注册 API `POST /api/auth/register`（创建租户+用户+默认分类，返回JWT）
- [x] 登录 API `POST /api/auth/login`（验证手机号+密码，返回JWT）
- [x] 当前用户 API `GET /api/auth/me`（需要 Bearer token）
- [x] 输入验证：手机号格式、密码长度、重复注册检查
- [x] 多租户隔离：注册自动创建独立租户，JWT 中包含 tenantId
- [x] 所有 API 测试通过，`pnpm build` 构建通过

### ✅ Block 3: UI 框架 + 布局（已完成）
- [x] shadcn/ui 初始化 + 安装组件（button, input, label, card, dialog, sheet, sonner, dropdown-menu, avatar, badge, separator, table, tabs）
- [x] lucide-react 图标库
- [x] 前端 API 客户端 `src/lib/api-client.ts`（fetch封装 + token管理）
- [x] AuthProvider `src/components/auth-provider.tsx`（登录状态管理）
- [x] 登录/注册页 `src/app/(auth)/login/page.tsx`（大输入框、大按钮、手机友好）
- [x] 侧边栏导航 `src/components/sidebar.tsx`（电脑端侧边栏8项 + 手机底部导航5项）
- [x] 手机顶部栏 `src/components/mobile-header.tsx`（更多菜单 dropdown）
- [x] Dashboard 布局 `src/app/(dashboard)/layout.tsx`（自动检查登录）
- [x] Dashboard 首页 `src/app/(dashboard)/page.tsx`（快捷操作4个大按钮 + 今日概览占位）
- [x] 根 layout 中文 lang="zh-CN"，引入 AuthProvider + Toaster
- [x] `pnpm build` 构建通过
- 设计理念：简约、大按钮、少步骤、手机优先
### ✅ Block 4: 商品管理（已完成）
- [x] 商品列表 API `GET /api/products`（搜索、分类筛选、分页）
- [x] 创建商品 API `POST /api/products`（四种价格、库存、分类）
- [x] 更新商品 API `PUT /api/products/[id]`
- [x] 删除商品 API `DELETE /api/products/[id]`（软删除）
- [x] 分类列表 API `GET /api/categories`
- [x] 商品表单弹窗 `src/components/product-form.tsx`（新建+编辑共用，Dialog）
- [x] 商品列表页 `src/app/(dashboard)/products/page.tsx`（卡片式、搜索、分类筛选、分页）
- [x] 所有 API 多租户隔离（tenantId 过滤）
- [x] `pnpm build` 构建通过 + API 测试通过
### ✅ Block 5: 供应商管理（已完成）
- [x] 供应商 CRUD API（`/api/suppliers`、`/api/suppliers/[id]`）
- [x] 供应商列表页 `src/app/(dashboard)/suppliers/page.tsx`（搜索、应付余额显示）
- [x] 通用联系人表单 `src/components/contact-form.tsx`（供应商+客户共用，DRY）
- [x] API 测试通过 + 构建通过

### ✅ Block 6: 客户管理（已完成）
- [x] 客户 CRUD API（`/api/customers`、`/api/customers/[id]`）
- [x] 客户列表页 `src/app/(dashboard)/customers/page.tsx`（搜索、类型筛选批发/零售、应收余额显示）
- [x] 复用 ContactForm 组件
- [x] API 测试通过 + 构建通过
### ✅ Block 7: 进货管理（已完成）
- [x] 进货单列表 API `GET /api/purchases`（含商品明细、供应商、分页）
- [x] 创建进货单 API `POST /api/purchases`（事务：建单 + 增库存 + 更新应付款）
- [x] 进货单详情 API `GET /api/purchases/[id]`
- [x] 通用订单表单 `src/components/order-form.tsx`（进货+销售共用）
- [x] 通用订单列表 `src/components/order-list.tsx`（进货+销售共用）
- [x] 进货列表页 + 新建进货页
- [x] 测试验证：进货20台→库存+20，付2000欠1000→供应商应付+1000

### ✅ Block 8: 销售管理（已完成）
- [x] 销售单列表 API `GET /api/sales`（含利润、客户、类型筛选）
- [x] 创建销售单 API `POST /api/sales`（事务：建单 + 扣库存 + 算利润 + 更新应收款）
- [x] 销售单详情 API `GET /api/sales/[id]`
- [x] 批发/零售切换自动更新价格
- [x] 库存不足检查
- [x] 散客销售（不选客户）
- [x] 销售列表页 + 新建销售页
- [x] 测试验证：卖10台×220=2200，利润=700(批发价220-进价150)，库存50→40，赊账700
- [x] `pnpm build` 构建通过
### ✅ Block 9: 应收应付（已完成）
- [x] 收付款 API `GET /api/payments`（汇总tab=summary、收款记录tab=receivable、付款记录tab=payable）
- [x] 创建收付款 API `POST /api/payments`（事务：记录 + 更新客户/供应商余额）
- [x] 收付款页面 `src/app/(dashboard)/payments/page.tsx`
  - 顶部汇总卡片（应收总额 + 应付总额）
  - 三个 Tab：欠款明细（一键收款/付款按钮）、收款记录、付款记录
  - 收付款弹窗：显示欠款金额、输入金额、选支付方式、一键全额收回/付清
- [x] 支付方式：现金、微信、支付宝、银行转账、其他
- [x] 防超额：收款不能超过欠款金额
- [x] 测试验证：张姐欠700，收款300→余额变400，供应商欠款1000不变
- [x] `pnpm build` 构建通过
### ✅ Block 10: 报表统计（已完成）
- [x] 报表 API `GET /api/reports`（type=profit/products/customers，支持日期范围）
- [x] 利润报表：总销售额、总利润、利润率、批发/零售占比、每日明细
- [x] 商品排行：畅销/滞销分析（按销售数量排序）
- [x] 客户统计：按购买金额排序、显示订单数+利润+欠款
- [x] 报表页面三 Tab + 日期筛选器
- [x] 测试验证：利润率31.8%正确

### ✅ Block 11: Excel 导出（已完成）
- [x] 导出 API `GET /api/export`（type=sales/purchases/receivable/payable）
- [x] 支持 query param token（浏览器 window.open 下载）
- [x] 销售记录导出：单号、日期、客户、商品、数量、单价、小计、成本、利润
- [x] 进货记录导出：单号、日期、供应商、商品、数量、单价
- [x] 应收/应付明细导出
- [x] 报表页面导出按钮
- [x] 测试验证：HTTP 200，生成16KB xlsx文件

### ✅ Block 12: 仪表板首页（已完成）
- [x] 仪表板 API `GET /api/dashboard`（并行查询6项数据）
- [x] 今日概览：销售额、利润、订单数、低库存数
- [x] 应收应付卡片（点击跳转收付款页）
- [x] 库存预警列表
- [x] 最近5笔销售
- [x] 4个快捷操作大按钮
- [x] 测试验证：数据全部正确
### ✅ Block 13: 部署上线 + 自动备份（已完成）
- [x] Dockerfile（多阶段构建，standalone 模式）
- [x] docker-compose.yml（PostgreSQL + Next.js + Nginx）
- [x] nginx.conf（反向代理）
- [x] .env.production（生产环境配置模板）
- [x] next.config.ts 加 `output: "standalone"`
- [x] scripts/backup.sh（每日自动备份，保留30天）
- [x] scripts/deploy.sh（一键部署脚本：装Docker→生成密码→构建→迁移→配置crontab）
- [x] .gitignore 更新（保留.env.production模板）
- [x] `pnpm build` 最终构建通过

## 🎉 全部 13 个 Block 已完成！

### ✅ Block 14: 角色权限管理（已完成）
- [x] api-auth.ts 新增 requireOwner() 中间件（非 owner 返回 403）
- [x] Products API: staff 不返回 costPrice, DELETE/修改进价 仅 owner
- [x] 前端: staff 不显示进价列、进价字段、删除按钮
- [x] OrderList: staff 不显示利润信息
- [x] Dashboard: staff 不显示利润, 术语改为"客户欠款/供应商欠款"
- [x] api-client.ts 新增 getUserRole/setUserRole/isOwner
- [x] auth-provider.tsx 新增 isOwner 属性

### ✅ Block 15: 开单提速（已完成）
- [x] Products API: sort=popular 按近30天销量排序
- [x] Customers API: sort=recent 按最近交易时间排序
- [x] order-form: 商品选择增加"常用"和"搜索"两个 Tab
- [x] order-form: 客户选择增加最近5个客户快捷按钮

### ✅ Block 16: 订单取消功能（已完成）
- [x] Sales [id] API: PUT { action: "cancel" } 事务回滚（库存+余额）
- [x] Purchases [id] API: PUT { action: "cancel" } 事务回滚（库存+余额）
- [x] 仅 owner + completed 状态可取消
- [x] order-list: 添加取消按钮 + cancelled 订单灰显

### ✅ Block 18: 销售退货（已完成）
- [x] Schema: 新增 ReturnOrder + ReturnOrderItem 模型
- [x] Returns API: GET 列表 + POST 创建退货（事务：库存回滚+利润调减+应收调减）
- [x] 退货列表页 /returns
- [x] ReturnForm 弹窗组件
- [x] 销售列表增加退货按钮
- [x] 侧边栏导航新增"退货"入口

### ✅ Block 19+20: 报表增强（已完成）
- [x] Reports API: type=trend 返回近6月销售/利润/订单 + 环比
- [x] Reports API: type=inventory 返回库存总额 + 按分类分组
- [x] 报表页新增"趋势"Tab + "库存"Tab
- [x] Tab 扩展到5个：利润/趋势/库存/商品/客户

### ✅ Block 21: 术语本地化（已完成）
- [x] "应收款/应付款"→"客户欠款/供应商欠款"
- [x] "编号"→"货号"

### ✅ Block 22: 操作审计日志（已完成）
- [x] AuditLog 数据模型 + 迁移
- [x] JWT payload 新增 userName 字段
- [x] logAudit() 工具函数（~40行）
- [x] 所有 CUD API（14个文件）注入审计日志记录
- [x] GET /api/audit 日志查询接口（分页+筛选，仅 owner）
- [x] 审计日志查看页 /settings/audit
- [x] 侧边栏新增"设置"入口（仅 owner 可见）

### ✅ Block 23: 员工管理（已完成）
- [x] GET/POST /api/users 员工列表+创建（仅 owner）
- [x] PUT/POST /api/users/[id] 更新信息/禁用启用/重置密码（仅 owner）
- [x] 员工管理页 /settings/staff
- [x] StaffForm 创建员工弹窗组件
- [x] 不能删除员工，只能禁用（保留历史数据）
- [x] 所有操作记录审计日志

### ✅ Block 25: 商品图片上传（已完成）
- [x] Product 模型新增 imageUrl 字段 + 迁移
- [x] POST /api/upload 图片上传接口（2MB限制，JPG/PNG/WebP）
- [x] 商品表单支持拍照/选图、预览、更换、删除
- [x] 商品列表显示缩略图（无图显示首字母）
- [x] Products API 支持 imageUrl 创建和更新

### ✅ Block 26: POS 式开单体验大改（已完成）
- [x] ProductGrid 组件：3列/4列网格卡片，图片+名称+价格+数量badge
- [x] OrderForm 改造为 POS 风格：
  - 商品网格始终可见，点击即加入购物车（数量+1）
  - 底部悬浮购物车摘要，展开可调整数量/单价/删除
  - 常用/全部 Tab + 内联搜索框
  - 一行式类型切换+客户选择
  - 支持 URL 参数 ?productId 自动预添加
- [x] 散客零售最少 2-3 步完成开单

### ✅ Block 27: 首页快速开单（已完成）
- [x] Dashboard API 返回 popularProducts（近30天销量前8，含 imageUrl）
- [x] 首页新增"快速开单"区域（4列热门商品网格）
- [x] 点击热门商品 → 跳转销售页 → 商品自动在购物车
- [x] 今日概览精简为一行摘要
- [x] 散客零售 2 步完成：首页点商品 → 确认提交

## 延后功能（TODOS）

- 条形码/二维码扫码录入（S）
- 微信通知（M）
- Block 17: 订单修改功能（取消旧单+重建新单）
