# E2E Tests

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

端到端测试目录。

## 核心 E2E：`core-e2e.mjs`

运行方式：

```bash
cd backend
npm run test:core-e2e
```

默认目标：`API_BASE_URL=http://localhost:3000/api`。

当前覆盖 P0 核心链路：

1. 健康检查。
2. 隔离临时学生账号准备与真实登录。
3. 管理员 / 审核员真实登录。
4. RBAC：学生访问管理员 AI Knowledge 统计接口必须被 403 拒绝。
5. 安全准入：新学生未签署责任书 / 未通过安全考试前不能提交漏洞。
6. 安全答题：获取随机 20 题题卷，验证题卷不泄露 `answerKeys`，提交正确答案后通过阈值。
7. 责任书签署后重新查询准入状态，确认允许提交漏洞。
8. 漏洞提交、PDF 附件上传、受控 PDF 预览。
9. AI 附件文本抽取与 PDF 报告草稿解析。
10. AI Knowledge 创建 / 审核、Skill Candidate 创建 / 批准 / 安装，并验证宿主机 `SKILL.md` 写入和容器路径映射。

脚本会在 `tests/e2e/evidence/` 写入 JSON 证据。默认在测试通过后清理本次临时数据库记录和安装出来的测试 Skill；如需保留现场用于排查：

```bash
CLEANUP_E2E_ARTIFACTS=false npm run test:core-e2e
```

## AI 问题会话 Phase 2：`ai-problem-session-phase2.mjs`

运行方式：

```bash
cd backend
npm run test:ai-problem-session
```

默认目标：`API_BASE_URL=http://localhost:3000/api`。

当前覆盖 AI Knowledge Base 进度表中的这些验收点：

1. KB-01：新建、恢复、heartbeat、leave、resolve、discard、跨用户访问拒绝。
2. KB-02：未解决会话不总结；寒暄、积分、商品、漏洞实时查询不进入知识沉淀。
3. KB-03：已解决会话生成结构化总结，缺字段或敏感内容拒绝。
4. KB-04 / KB-05：高风险 prompt injection、Authorization、Cookie、手机号、邮箱、真实资产 URL、原始请求包样例拒绝入库。
5. KB-06 / KB-07：同类问题聚类、duplicateRiskScore、mergeSuggestion、高频高质自动入库、低质量或安全风险不入库。

脚本会写入 `tests/e2e/evidence/ai-problem-session-phase2-*.json`。最近一次本地验证结果为 `14/14 passed`，证据文件：`tests/e2e/evidence/ai-problem-session-phase2-phase2_mpv4z6c3_76933c.json`。

## 与 smoke test 的区别

- `tests/api/core-api-smoke.mjs`：只验证主要 API 是否可达、认证账号是否可用。
- `tests/e2e/core-e2e.mjs`：创建隔离临时用户，真实执行跨模块状态流转，更适合作为 P0 回归验收。
- `tests/e2e/ai-problem-session-phase2.mjs`：聚焦 AI 问题会话式知识沉淀，不覆盖漏洞提交、附件、Skill 安装等跨模块 P0 链路。

## AI 复测浏览器 UI：`frontend/e2e/ai-retest-ui.spec.ts`

先启动本地前后端与 PostgreSQL，再运行：

```bash
cd frontend
npm run test:e2e:ai-retest
```

该用例使用隔离数据库 fixture，覆盖管理员进入漏洞详情、查看 AI 复测报告、按需读取脱敏证据、引用审核意见草稿并带入人工审核弹窗、启动确认弹窗和浏览器 console/page error 监控。真实 Hermes 规划、RBAC、策略、审批和报告后端链路仍由 `tests/e2e/ai-vulnerability-retest.mjs` 覆盖。
