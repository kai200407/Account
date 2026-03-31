<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 记账系统 (jizhang) — Agent 快速入门

## 这是什么
多租户记账系统，7人使用，管理商品/进货/销售/应收应付/报表。

## 技术栈
Next.js 16 + React 19 + Prisma 6 + SQLite(dev)/PostgreSQL(prod) + shadcn/ui + TailwindCSS v4

## 开始之前必读
1. `CLAUDE.md` — Agent 工作流程和执行纪律
2. `docs/ARCHITECTURE.md` — 分层规则和业务逻辑
3. `docs/BACKLOG.md` — 选择下一个任务
4. `docs/CONVENTIONS.md` — 编码规范

## 常用命令
```bash
pnpm dev          # 开发服务器
pnpm build        # 构建（每次改动必须验证）
pnpm exec prisma migrate dev   # 数据库迁移
pnpm exec prisma db seed       # 种子数据
```
