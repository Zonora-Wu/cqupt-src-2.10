# Prisma 安全改动流程

用户参数：`$ARGUMENTS`

用于 CQUPT-SRC 的 Prisma schema / migration / seed / 后端模型联动改动。

## 必须先读

1. `database/prisma/schema.prisma`
2. `backend/package.json` 中 Prisma scripts
3. `backend/scripts/prisma-*.cjs`
4. 与 `$ARGUMENTS` 相关的 backend module：controller / service / types / validation
5. 如果改 AI 自动复测，还要读：
   - `docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`
   - `backend/src/modules/ai-vulnerability-retest/`

## 禁止事项

- 不要修改 `backend/node_modules/.prisma/client`。
- 不要把生成 client 当作 schema 权威来源。
- 不要手写和 schema 不一致的 TypeScript 类型。
- 不要删除已有 migration。
- 不要在不了解当前 diff 的情况下覆盖用户未提交改动。
- 不要读取 `.env`；只根据 `.env.example` 和 package scripts 理解变量名。

## 工作流

1. 说明本次 schema 变化：新增 / 删除 / 修改哪些 model、enum、relation、index。
2. 检查是否需要 migration。
3. 修改 `database/prisma/schema.prisma`。
4. 如需 migration，创建语义化 migration 目录，写 `migration.sql`。
5. 同步修改后端类型、validation、service、controller、RBAC/AuditLog（如涉及）。
6. 运行：

```bash
cd backend && npm run prisma:validate
cd backend && npm run build
```

7. 最后汇报：schema diff、migration 路径、受影响模块、验证输出、风险点。
