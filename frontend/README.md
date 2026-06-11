# CQUPT-SRC Frontend

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

前端使用 React 19 + TypeScript + Vite 6 + Tailwind CSS 4 构建。

## 当前能力

- 访客端：首页、平台规则、公开公告、证书查询、学习资源、关于平台、登录注册弹窗。
- 用户端：首页、提交漏洞、我的漏洞、学习中心、邮宝 AI 助手、积分商城、我的证书、排行榜、平台公告、个人中心、账号安全、系统设置。
- 审核员端：首页、漏洞审核、复测归档、证书管理、AI 辅助、审核记录、公告管理。
- 管理员端：首页、漏洞管理、证书管理、用户管理、公告管理、学习管理、积分商城、审计日志、系统设置、AI 知识沉淀管理。
- AI 助手支持 Markdown、代码块复制、卡片内操作、附件待发送区、报告草稿卡片、回到底部按钮。

## 本地开发

```bash
cd /home/cocking/projects/cqupt-src-2.10/frontend
npm run dev
```

默认地址：

```text
http://localhost:5173
```

开发环境通过 Vite proxy 将 `/api` 转发到 `http://localhost:3000`。

## 构建

```bash
cd /home/cocking/projects/cqupt-src-2.10/frontend
npm run build
```

## Lint 状态

```bash
npm run lint
```

当前 lint 会暴露历史 React 规则问题（主要是 `react-hooks/set-state-in-effect`、部分 hooks 顺序与空 block），但本次文档更新未修改业务代码。生产构建 `npm run build` 已通过。

## 演示账号

```text
学生：2025001 / 123456+-
审核员：0000001 / auditor123456+-
管理员：0000000 / admin123456+-
邮箱验证码：123456（本地开发）
```

## 重要组件与页面

```text
src/pages/user/UserAIAssistant.tsx
src/pages/user/UserSubmitVulnerability.tsx
src/pages/user/UserMyVulnerabilities.tsx
src/pages/admin/AdminAiKnowledgeManagement.tsx
src/pages/admin/AdminSystemSettings.tsx
src/components/security/SecurityExamDialog.tsx
src/components/security/ResponsibilityAgreementDialog.tsx
src/components/ui/SurfacePanel.tsx
src/components/ui/PageHeader.tsx
src/components/ui/SearchInput.tsx
src/components/ui/SelectInput.tsx
src/components/ui/SlideVerify.tsx
```

## 注意事项

- 文件上传、权限判断、证书核验、商城兑换、AI action 都不能只靠前端判断。
- PDF 预览通过后端受控接口返回 blob，不直接暴露 MinIO 地址。
- 邮宝不直连 Hermes Agent；所有 AI 请求必须走后端 AI Gateway。
- 可操作卡片必须嵌在 AI 回复框内，不在回复文本外另起灰色分割块。
- 商品卡片采用上图下文纵向结构，代码块采用 neutral 深色系并带复制按钮。
