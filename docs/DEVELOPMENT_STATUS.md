# 开发状态

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 当前阶段

```text
阶段：核心业务闭环 + AI 助手 + AI 知识沉淀链路已落地。
后端：NestJS / Prisma 构建通过，健康检查可用。
前端：Vite / React 构建通过，用户端、审核员端、管理员端页面已接入主要真实接口。
AI：后端 AI Gateway 代理平台 Hermes；邮宝支持确定性业务响应、Agent 回复、卡片、附件、报告草稿和知识沉淀。
知识沉淀：多轮会话捕获、AI 总结、AI+规则评分、相似去重、管理员审核、KB 入库、Skill Candidate、受控安装链路已验证。
部署待确认：Ubuntu Docker 全量联调；平台 Hermes skills 目录权限已修正并通过真实安装链路验证。
```

## 已完成能力

### 前端

- 访客端、用户端、审核员端、管理员端页面。
- 主题切换、统一背景、Logo、菜单、卡片、下拉框等复用组件。
- 登录、注册、邮箱验证码、滑块验证、刷新登录态校验。
- 个人中心、头像上传、邮箱修改、密码修改、账号安全日志。
- 漏洞提交、我的漏洞、补充材料、PDF 附件上传与受控预览。
- 审核员审核队列与审核操作。
- 管理员漏洞管理、用户管理、审计日志、系统设置。
- 证书管理、签发、撤销、PDF 预览、用户证书与公开核验。
- 公告、学习资源、积分商城、兑换、商品管理。
- 安全答题准入与提交前缺失条件提示。
- 邮宝 AI 助手：聊天、Markdown、代码块复制、卡片内操作、附件待发送区、报告草稿卡片。
- 管理端 AI 知识沉淀页面：知识条目、会话队列、AI 评分、重复风险、合并建议、Skill Candidate 审核。

### 后端

- 健康检查、环境变量校验、CORS、JWT、RBAC、权限守卫。
- Auth、Account、Access、Captcha、Vulnerability、Attachment、Certificate、Announcement、Learning、Points Mall、Users、AuditLog、Dashboard、Notification 模块。
- PDF 附件安全校验：MIME、扩展名、magic bytes、大小限制、SHA-256、MinIO 存储、审计日志。
- 漏洞状态流转、审核意见、补充材料、复测队列。
- 证书模板、证书 PDF 生成、受控预览和公开脱敏核验。
- 积分商城事务：积分扣减、库存扣减、兑换记录、取消返还、审计日志。
- 安全答题：`SecurityQuestion` 题库、随机组卷、提交判分、`SecurityExamAttempt` 记录、管理员题库接口。
- AI Gateway：`/api/ai/chat`、Context Injection、确定性响应、Agent 调用、结构化响应解析、动作确认接口。
- AI 附件：`/api/ai/attachments/text`、`/api/ai/report-drafts`，明确报告意图才生成草稿。
- AI Knowledge：会话 turn 记录、会话总结、AI 评分、规则兜底、重复检测、合并建议、KB 审核、反馈接口。
- Skill Candidate：从知识条目生成候选、审批、安装、安装日志、源知识状态联动。

### 数据库

- PostgreSQL + Prisma schema 与 migrations。
- 用户、角色、权限、授权策略、审计日志。
- 准入、责任书、安全答题题库与答题记录。
- 漏洞报告、事件、附件、证书、公告、学习资源、积分商城。
- AI 相关模型：`AiCallLog`、`AiKnowledgeEntry`、`AiKnowledgeCaptureJob`、`AiKnowledgeConversation`、`AiKnowledgeConversationTurn`、`AiSkillCandidate`、`AiSkillInstallLog`。
- AI Knowledge Conversation 已包含评分字段、隐私风险、相似知识匹配、重复风险和合并建议。

## 当前关键验证结果

```bash
cd backend && npm run build
cd frontend && npm run build
curl -s http://localhost:3000/api/health
curl -s http://localhost:5000/health
```

已验证：

- 后端 TypeScript 构建通过。
- 前端 Vite 构建通过。
- 后端健康检查返回 200。
- AI Knowledge Base → Skill Candidate → 安装链路已使用真实平台 skills 挂载目录完成核心 E2E 验证。
- `backend npm run test:core-e2e` 已覆盖安全答题准入、责任书、漏洞提交、PDF 附件、AI 报告草稿、知识沉淀、Skill 安装与 RBAC 拒绝。

## 已知限制

- 生产环境真实 SMTP 邮件发送仍需接入；开发环境验证码为固定 `123456`。
- 平台 Hermes 专属 skills 已迁移到宿主可写目录 `/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src`，并通过 Docker bind mount 暴露为容器内 `/opt/data/skills/cqupt-src`；后端 `CQUPT_HERMES_SKILLS_ROOT` 已指向该目录，真实 Skill Candidate 安装链路和容器读取均已验证。
- 证书模板坐标可视化仍可继续增强。
- 大规模生产数据下，AI 知识沉淀评分阈值、去重阈值和审核工作量需要持续观察。

## 近期待办

1. 完成 AI Gateway 下一步架构调整：从“每轮预注入大量平台数据”升级为“AI 先判断需求，再通过只读工具或按需上下文获取平台数据”。详细方案见 `docs/AI.md` 的“10.0 下一步待完成：按需查询平台数据”。
2. 复核平台 Hermes skills 独立挂载目录在容器重启和部署迁移后仍保持可写，并把该检查纳入部署验收。
3. 接入真实 SMTP，并将开发环境 `devCode` 输出仅保留在本地模式。
4. 在 Ubuntu 服务器部署环境复跑 `cd backend && npm run test:core-e2e`，确认 Docker Compose / Nginx / MinIO / Hermes 全链路在生产拓扑下仍通过。
5. Ubuntu 服务器 Docker Compose 全服务联调与 Nginx 反向代理配置验证。
