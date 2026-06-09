# AI 漏洞自动复测阶段实现

用户参数：`$ARGUMENTS`

你要在 CQUPT-SRC 项目中实现 AI 漏洞自动复测的指定阶段。不要一次性实现全部方案。

## 必须先读

1. `CLAUDE.md`
2. `docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`
3. `docs/HERMES_RUNTIME.md`
4. `database/prisma/schema.prisma`
5. `backend/src/modules/ai-vulnerability-retest/` 中与本阶段相关的文件
6. 如果涉及 AI/Hermes，还要读：
   - `docs/AI.md`
   - `docs/AI_KNOWLEDGE_BASE.md`
   - `backend/src/modules/ai/`

## 阶段边界

根据 `$ARGUMENTS` 判断本次只做哪个阶段，例如：

- `phase-1`：Prisma schema、migration、enum、基础状态机、后端类型，不做前端、不接 Runner、不调用 Hermes。
- `phase-2`：Controller/API/RBAC/AuditAction，不做 Runner 执行。
- `phase-3`：Hermes planning service，只生成计划/建议，不持有用户 JWT，不直接访问数据库外部接口。
- `phase-4`：Policy service 和技术安全校验。
- `phase-5`：Worker + Runner client，但 Runner 只能执行平台内置动作模板。
- `phase-6`：管理员/审核员前端 UI。
- `phase-7`：E2E、回归测试、文档同步。

如果 `$ARGUMENTS` 不明确，先列出你理解的阶段并要求用户确认，不要直接动手。

## 强制安全边界

- 高风险漏洞必须进入 `ADVISORY_ONLY`，不能进入 Runner。
- `ADVISORY_ONLY` 报告结论必须表达平台未执行自动复测。
- Runner 不接收用户 JWT、数据库连接、MinIO 凭据或 Hermes 任意脚本。
- Runner 只执行后端策略审查批准的低风险内置动作模板。
- 人工确认目标范围不能绕过 SSRF、内网、metadata、危险协议、DNS rebinding、redirect 越界等技术安全校验。
- 审核意见一键引用必须进入人工编辑/确认状态，不能自动保存最终审核意见。

## 实施流程

1. 先输出本阶段“会改哪些文件 / 不会改哪些文件”。
2. 检查当前 git diff，避免覆盖用户已有改动。
3. 做最小必要修改，不改 `dist`、`node_modules`、`tmp`、`uploads`、`tests/e2e/evidence`。
4. 修改后按影响范围验证：
   - 后端：`cd backend && npm run build`
   - Prisma：`cd backend && npm run prisma:validate`
   - 前端：`cd frontend && npm run build`
   - 自动复测相关 E2E：只在本阶段需要时运行对应测试脚本
5. 最后汇报：修改文件、验证命令、真实输出摘要、未验证项、下一阶段建议。
