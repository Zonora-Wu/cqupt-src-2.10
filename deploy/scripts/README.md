# Scripts

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-08。当前项目包含 AI 漏洞自动复测（Phase 1-9 + 7.5），使用双通道 Runner + Hermes Direct。
> 启动脚本不管理 Hermes 容器（端口 5000/5001）、Runner 服务 — 它们作为独立外部依赖，需单独启动。
> 脚本会检查这些外部服务是否运行并在最终输出中显示状态，不影响脚本正常执行。
>
> 关键权威文档：`docs/AI.md`、`docs/HERMES_RUNTIME.md`、`docs/deployment/HERMES_DIRECT.md`、`docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`。
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
# 后端健康检查
curl -s http://localhost:3000/api/health

# 平台 Hermes Agent（独立容器，需单独启动）
curl -s http://localhost:5000/health

# Hermes Direct 复测容器（独立容器，需单独启动）
curl -s http://localhost:5001/health
```

访问：

| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:5173 |
| 后端 | http://localhost:3000/api/health |
| 平台 Hermes | http://localhost:5000/health |
| Hermes Direct | http://localhost:5001/health |
| MinIO Console | http://localhost:9001 |

## 外部依赖说明

启动脚本只管理 PostgreSQL、Redis、MinIO 容器和前后端开发服务器。以下服务需单独启动：

| 服务 | 管理方式 | 说明 |
|------|---------|------|
| 平台 Hermes Agent (端口 5000) | `cd /home/cocking/cqupt-src-hermes-linux && docker compose up -d` | AI 助手、AI 复测计划生成 |
| Hermes Direct (端口 5001) | 同上 docker compose（含 `hermes-retest-agent` + `retest-egress-proxy`） | AI 复测 HERMES_DIRECT 模式 |
| Runner (端口未固定) | 手动启动 `retest-runner/` | AI 复测 CONTROLLED_RUN 模式 |

脚本启动时会检查这些服务是否可达并在最终输出中显示状态。不可达时仅警告，不阻断启动。

## Windows PowerShell 启动 / 关停

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\start-local.ps1
```

```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\stop-local.ps1
```
