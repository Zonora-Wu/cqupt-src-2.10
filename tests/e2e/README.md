# E2E Tests

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
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

## 与 smoke test 的区别

- `tests/api/core-api-smoke.mjs`：只验证主要 API 是否可达、认证账号是否可用。
- `tests/e2e/core-e2e.mjs`：创建隔离临时用户，真实执行跨模块状态流转，更适合作为 P0 回归验收。
