# Backend Tests

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

后端测试目录。

## 核心 API 冒烟测试

本测试用于本地开发阶段快速确认核心接口是否可用。它只调用登录和只读接口，不创建或修改业务数据。

默认目标：

```text
http://localhost:3000/api
```

运行：

```powershell
cd backend
npm.cmd run test:core-api
```

如后端不在默认地址，可指定：

```powershell
$env:API_BASE_URL="http://localhost:3000/api"
npm.cmd run test:core-api
```

覆盖范围：

- 健康检查
- 三类演示账号登录：学生、审核员、管理员
- 当前用户与准入状态
- 公告、学习资源、漏洞、证书、积分商城
- 管理端用户管理、审计日志、系统设置证书模板

如果返回的是前端 HTML 而不是 API JSON，说明当前端口运行的不是后端服务，或代理配置没有命中后端。

## 后续建议

- 单元测试
- API 集成测试
- 权限测试
- 文件上传安全测试
