# Scripts

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 本地一键启动 / 关闭

### Linux / WSL / macOS

```bash
cd /home/cocking/projects/cqupt-src-2.10
bash deploy/scripts/start-local.sh
```

停止：

```bash
bash deploy/scripts/stop-local.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1
```

## 启动后检查

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:5000/health
```

访问：

| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:3000/api/health |
| 平台 Hermes | http://localhost:5000/health |
| MinIO Console | http://localhost:9001 |

## 维护脚本原则

- 脚本只管理本项目依赖与开发服务，不直接写入真实密钥。
- 平台 Hermes 的技能同步、模型路由和权限问题以 `docs/HERMES_RUNTIME.md` 为准。
- 涉及数据库迁移和 seed 的脚本必须显式提示环境，避免误操作生产库。
