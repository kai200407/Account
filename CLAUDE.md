# CLAUDE.md — AI Agent 工作指南

> 这是 AI Agent 的唯一入口文件。每次对话开始时必须先读取此文件。

## 快速导航

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | Next.js 版本注意事项 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 项目架构、分层规则、数据库模型 |
| [docs/BACKLOG.md](./docs/BACKLOG.md) | 待办功能列表（从这里选任务） |
| [docs/PROGRESS.md](./docs/PROGRESS.md) | 已完成的所有 Block 记录 |
| [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) | 编码规范、文件命名、API 约定 |

## 执行纪律（必须遵守）

### 1. 每次开始前
- 读取 `docs/BACKLOG.md`，确认下一个要做的任务
- 读取 `docs/PROGRESS.md`，了解已完成的工作
- 读取 `docs/ARCHITECTURE.md`，了解分层规则

### 2. 执行循环（每个任务）
```
读状态 → 选任务 → 写代码 → 测试验证 → git commit → 更新 PROGRESS.md
```
- 一次只做一个功能点，不要跨任务
- 每步完成必须 `pnpm build` 验证
- 涉及数据库变更必须先测试事务正确性

### 3. 禁止行为
- ❌ 不要删除已有功能来"修" bug
- ❌ 不要修改不相关的文件
- ❌ 不要跳过测试验证
- ❌ 不要一次提交超过一个功能

### 4. 提交规范
```
feat(模块): 简短描述
fix(模块): 简短描述
refactor(模块): 简短描述
```
模块名: auth, products, sales, purchases, payments, reports, dashboard, suppliers, customers

## 技术栈速查

| 技术 | 版本 | 说明 |
|------|------|------|
| Next.js | 16.2.1 | ⚠️ 非标准版本，查 `node_modules/next/dist/docs/` |
| React | 19.2.4 | |
| Prisma | 6.19.2 | prisma-client-js generator |
| DB | SQLite(开发) / PostgreSQL(生产) | |
| UI | shadcn/ui + TailwindCSS v4 | |
| Auth | JWT (jsonwebtoken) + bcryptjs | |

## 测试账号
- 手机号: 13800138000 / 密码: 123456 / 角色: owner
