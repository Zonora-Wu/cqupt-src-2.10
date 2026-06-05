# 文档同步检查

用于在代码改动后同步 CQUPT-SRC 权威文档，避免文档和实现漂移。

## 先判断是否需要同步

如果本次改动涉及以下任一项，必须检查 docs：

- AI / Hermes / AI Knowledge / Problem Session
- AI 漏洞自动复测
- Prisma schema / 数据模型
- API 路由或请求响应结构
- RBAC / AuditLog / 权限点
- 部署、运行目录、Docker、Hermes runtime
- 前端重要交互流程

## 优先文档

- `docs/AI.md`
- `docs/AI_KNOWLEDGE_BASE.md`
- `docs/HERMES_RUNTIME.md`
- `docs/api/README.md`
- `docs/security/README.md`
- `docs/architecture/DATABASE_MODEL.md`
- `docs/architecture/AI_CONTEXT_INJECTION.md`
- `docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`

## 工作方式

1. 只更新与本次代码变化直接相关的文档。
2. 区分“已实现”和“目标态/规划中”，不要把规划写成已完成。
3. 如果无法验证，不要写“已完成”；写“待代码确认”或“待验证”。
4. 更新后检查 Markdown code fence 是否平衡。

## 输出

- 需要同步的文档
- 实际修改的文档
- 未同步原因
- 文档验证结果
