# Tests

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

跨端测试目录。

## 测试入口

- `api/core-api-smoke.mjs`：核心 API smoke test。运行：`cd backend && npm run test:core-api`。
- `e2e/core-e2e.mjs`：P0 核心端到端回归。运行：`cd backend && npm run test:core-e2e`。
- `e2e/evidence/`：E2E 运行证据 JSON。失败时用于定位，成功时保留最近一次证据即可。

## 当前 P0 E2E 覆盖

`core-e2e.mjs` 已覆盖：安全答题准入、责任书签署、漏洞提交、PDF 附件上传和受控预览、AI 附件文本抽取、报告草稿解析、AI Knowledge 创建/审核、Skill Candidate 审核/安装、学生访问管理端接口的 RBAC 拒绝。

脚本默认会清理本次临时用户、漏洞、知识、候选 Skill 和安装出来的测试 Skill；设置 `CLEANUP_E2E_ARTIFACTS=false` 可保留现场。
