# CQUPT-SRC 平台 Hermes 运行目录说明

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

本文档记录 CQUPT-SRC 平台实际接入的 Hermes Agent 独立容器目录、挂载关系、skills 存放位置和维护注意事项。

> 注意：本项目存在两套容易混淆的 Hermes 环境：
>
> - 当前开发者 CLI 使用的 Hermes：`/home/cocking/.hermes/`
> - CQUPT-SRC 平台后端实际调用的 Hermes 独立容器：`/home/cocking/cqupt-src-hermes-linux/`
>
> 平台用户端 AI 助手调用的是后者，不是当前 CLI Hermes。

---

## 1. 平台 Hermes 根目录

平台 Hermes 独立部署目录：

```text
/home/cocking/cqupt-src-hermes-linux
```

当前目录结构核心文件：

```text
/home/cocking/cqupt-src-hermes-linux/
├── docker/
│   ├── docker-compose.yml
│   └── env/
│       └── .env.agent
└── data/
    └── ...
```

其中：

```text
/home/cocking/cqupt-src-hermes-linux/docker/docker-compose.yml
```

是平台 Hermes 容器编排文件。

```text
/home/cocking/cqupt-src-hermes-linux/docker/env/.env.agent
```

是平台 Hermes 容器环境变量文件，通常包含模型供应商密钥、网关配置等敏感信息。不要提交到 Git。

---

## 2. Docker Compose 配置

平台 Hermes 使用独立 Docker 容器运行。

当前 compose 核心配置：

```yaml
services:
  hermes-agent:
    image: nousresearch/hermes-agent:latest
    container_name: hermes-agent
    restart: unless-stopped
    env_file:
      - ./env/.env.agent
    ports:
      - "5000:5000"
    volumes:
      - ../data:/opt/data
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5).read()"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    command: gateway run --replace
```

关键点：

```text
宿主机：/home/cocking/cqupt-src-hermes-linux/data
容器内：/opt/data
```

也就是说，平台 Hermes 容器内所有需要持久化的配置、skills、session、日志等数据，应优先放在 `/opt/data` 下，对应宿主机 `data` 目录。

---

## 3. 容器名称与访问地址

容器名称：

```text
hermes-agent
```

镜像：

```text
nousresearch/hermes-agent:latest
```

端口：

```text
宿主机 5000 -> 容器 5000
```

平台后端通过 OpenAI-compatible API 调用 Hermes：

```text
http://localhost:5000/v1/chat/completions
```

当前模型路由约定：

```text
后端 OPENAI_MODEL=hermes-agent   # 后端虚拟模型名
Hermes config.yaml 默认模型       # 平台/微信回复使用 DeepSeek 系列
CLI 当前对话模型                 # 可继续使用 GPT，与平台容器无关
```

也就是说，微信/平台用户回复走平台 Hermes 容器内配置的 DeepSeek；当前终端 CLI 对话是否使用 GPT 由 CLI 自身 provider/model 决定，二者互不覆盖。

健康检查地址：

```text
http://localhost:5000/health
```

验证命令：

```bash
curl -s http://localhost:5000/health
```

预期返回：

```json
{"status":"ok","platform":"hermes-agent"}
```

---

## 4. 平台 Hermes skills 目录

平台 Hermes 容器实际读取的 skills 目录在容器内：

```text
/opt/data/skills
```

宿主机对应目录：

```text
/home/cocking/cqupt-src-hermes-linux/data/skills
```

CQUPT-SRC 专属 skills 目录：

```text
容器内：/opt/data/skills/cqupt-src
宿主机：/home/cocking/cqupt-src-hermes-linux/data/skills/cqupt-src
```

当前已同步到平台 Hermes 容器内的 CQUPT-SRC skills：

```text
/opt/data/skills/cqupt-src/cqupt-src-admin-analytics/SKILL.md
/opt/data/skills/cqupt-src/cqupt-src-ai-card-protocol/SKILL.md
/opt/data/skills/cqupt-src/cqupt-src-ai-security-boundary/SKILL.md
/opt/data/skills/cqupt-src/cqupt-src-auditor-review/SKILL.md
/opt/data/skills/cqupt-src/cqupt-src-learning-recommender/SKILL.md
/opt/data/skills/cqupt-src/cqupt-src-mall-search/SKILL.md
/opt/data/skills/cqupt-src/cqupt-src-platform-overview/SKILL.md
/opt/data/skills/cqupt-src/cqupt-src-vulnerability-assistant/SKILL.md
/opt/data/skills/cqupt-src/mall-product-search/SKILL.md
```

说明：

- `cqupt-src-*` 是正式平台专属 skills。
- `mall-product-search` 是早期旧版商城搜索 skill，当前保留是为了避免历史引用断掉。
- 后续推荐平台接入使用 `cqupt-src-mall-search`。

---

## 5. 当前 CLI Hermes 与平台 Hermes 的区别

当前开发者 CLI Hermes 的默认 skills 目录：

```text
/home/cocking/.hermes/skills
```

平台 Hermes 独立容器的 skills 目录：

```text
/home/cocking/cqupt-src-hermes-linux/data/skills
```

两者不会自动同步。

因此，如果在当前 CLI 会话中使用 Hermes skill 工具创建或修改 skill，默认只会写入：

```text
/home/cocking/.hermes/skills
```

平台容器不会自动读取这些变化。

需要同步到平台容器：

```text
/home/cocking/.hermes/skills/cqupt-src
  -> /home/cocking/cqupt-src-hermes-linux/data/skills/cqupt-src
  -> 容器内 /opt/data/skills/cqupt-src
```

---

## 6. 同步 CQUPT-SRC skills 到平台 Hermes

由于平台 Hermes 的 `data` 目录由容器内 UID 创建，宿主机当前用户可能没有直接写权限。当前已观察到的生产风险点：

```text
/home/cocking/cqupt-src-hermes-linux/data 可能为 10000:10000 且 700
```

如果后端直接写入：

```text
/home/cocking/cqupt-src-hermes-linux/data/skills
```

可能出现：

```text
PermissionError: [Errno 13] Permission denied
```

推荐通过容器复制。

### 6.1 从当前 CLI Hermes 同步到平台容器

```bash
cd /home/cocking/.hermes/skills
rm -f /tmp/cqupt-src-skills.tar
tar -cf /tmp/cqupt-src-skills.tar cqupt-src

docker exec hermes-agent mkdir -p /opt/data/skills
docker cp /tmp/cqupt-src-skills.tar hermes-agent:/tmp/cqupt-src-skills.tar
docker exec hermes-agent sh -lc 'cd /opt/data/skills && tar -xf /tmp/cqupt-src-skills.tar'
```

验证：

```bash
docker exec hermes-agent sh -lc 'find /opt/data/skills/cqupt-src -maxdepth 2 -name SKILL.md | sort'
```

统计数量：

```bash
docker exec hermes-agent sh -lc 'find /opt/data/skills/cqupt-src -maxdepth 2 -name SKILL.md | wc -l'
```

当前应为：

```text
9
```

### 6.2 重启平台 Hermes

skills 同步完成后，重启容器让 Hermes 重新加载：

```bash
docker restart hermes-agent
```

然后验证健康状态：

```bash
curl -s http://localhost:5000/health
```

---

## 7. 查看平台 Hermes 容器内 skills

列出 CQUPT-SRC skills：

```bash
docker exec hermes-agent sh -lc 'find /opt/data/skills/cqupt-src -maxdepth 2 -name SKILL.md | sort'
```

查看某个 skill 内容：

```bash
docker exec hermes-agent sh -lc 'sed -n "1,120p" /opt/data/skills/cqupt-src/cqupt-src-platform-overview/SKILL.md'
```

不要把这些命令输出中的敏感配置写入文档或提交到 Git。

---

## 8. 配置文件位置

平台 Hermes 主要配置通常位于容器内：

```text
/opt/data/config.yaml
```

宿主机对应路径：

```text
/home/cocking/cqupt-src-hermes-linux/data/config.yaml
```

但由于宿主机 `data` 目录权限可能归容器 UID 所有，读取和修改时更稳定的方式是通过容器执行：

```bash
docker exec hermes-agent sh -lc 'sed -n "1,160p" /opt/data/config.yaml'
```

修改模型配置时，应优先通过明确的配置命令或安全的文件编辑方式完成，修改后需要重启容器：

```bash
docker restart hermes-agent
```

注意：

- 不要把 API Key 写入项目 docs。
- 不要把 `.env.agent` 提交到 Git。
- 项目后端中的 `OPENAI_MODEL=hermes-agent` 是平台内部虚拟名称，实际模型由平台 Hermes config 决定。

---

## 9. 后端与平台 Hermes 的关系

CQUPT-SRC 后端不直接调用第三方模型供应商，而是调用平台 Hermes Agent：

```text
React 前端
  -> NestJS Backend AI Gateway
  -> http://localhost:5000/v1/chat/completions
  -> hermes-agent 容器
  -> DeepSeek / OpenAI / 其他模型供应商
```

安全边界：

- 前端禁止直连 Hermes Agent。
- 所有用户身份和权限以后端 JWT/RBAC 为准。
- 用户上下文由后端构建并注入 system prompt。
- 平台 skills 是共享能力，不保存实时用户数据。
- 实时商品、积分、漏洞、证书数据必须由后端查库提供。

---

## 10. 维护注意事项

### 10.1 修改 skill 后必须同步

如果通过当前 CLI Hermes 创建或修改了 skill：

```text
/home/cocking/.hermes/skills/cqupt-src/...
```

需要同步到平台容器：

```text
/opt/data/skills/cqupt-src/...
```

否则平台用户端 AI 不会生效。

### 10.2 同步后必须重启或新会话

Hermes 对 skills 的加载通常在会话启动或进程启动时完成。为了让平台稳定读到最新 skills，推荐：

```bash
docker restart hermes-agent
```

### 10.3 不要在 skill 中写实时数据

不要把这些内容写进 skill：

- 当前商品库存。
- 用户积分。
- 用户漏洞列表。
- 数据库 ID 的临时快照。
- 管理员新建商品的状态。
- 审核队列实时数量。

这些应由后端实时查库，通过 Context Injection 或后端确定性响应提供。

### 10.4 适合写进 skill 的内容

适合写进 skill：

- 平台业务规则。
- 安全边界。
- 卡片协议。
- 商品搜索语义。
- 漏洞报告写作方法。
- 学习推荐逻辑。
- 审核员辅助流程。
- 管理员分析输出结构。

---

## 11. 常用命令速查

查看容器状态：

```bash
docker ps --filter name=hermes-agent
```

重启容器：

```bash
docker restart hermes-agent
```

健康检查：

```bash
curl -s http://localhost:5000/health
```

查看 compose 文件：

```bash
sed -n '1,120p' /home/cocking/cqupt-src-hermes-linux/docker/docker-compose.yml
```

查看平台 skills：

```bash
docker exec hermes-agent sh -lc 'find /opt/data/skills/cqupt-src -maxdepth 2 -name SKILL.md | sort'
```

同步本地 CLI skills 到平台容器：

```bash
cd /home/cocking/.hermes/skills
rm -f /tmp/cqupt-src-skills.tar
tar -cf /tmp/cqupt-src-skills.tar cqupt-src
docker exec hermes-agent mkdir -p /opt/data/skills
docker cp /tmp/cqupt-src-skills.tar hermes-agent:/tmp/cqupt-src-skills.tar
docker exec hermes-agent sh -lc 'cd /opt/data/skills && tar -xf /tmp/cqupt-src-skills.tar'
docker restart hermes-agent
curl -s http://localhost:5000/health
```

---

## 12. 当前结论

CQUPT-SRC 平台实际运行的 Hermes Agent 是独立 Docker 容器：

```text
/home/cocking/cqupt-src-hermes-linux
```

平台容器实际读取的持久化目录是：

```text
/home/cocking/cqupt-src-hermes-linux/data
```

容器内对应：

```text
/opt/data
```

平台专属 skills 应维护在：

```text
/home/cocking/cqupt-src-hermes-linux/data/skills/cqupt-src
```

或通过容器写入：

```text
/opt/data/skills/cqupt-src
```

当前 CLI 的：

```text
/home/cocking/.hermes/skills
```

只影响开发者当前 Hermes，不会自动影响平台用户端 AI。
---

## 13. 后端按角色显式控制 Skill 路由

平台接入 Hermes Agent 时，不依赖 Agent 自己在全量 skill 库中自由选择角色能力，而是在 NestJS 后端增加显式路由层：

```text
backend/src/modules/ai/ai.skill-router.service.ts
```

核心原则：

```text
人/管理员：决定平台有哪些 skills、哪些进入平台容器。
平台后端：根据 JWT 角色、AI mode、用户问题显式计算本轮 allowed / active / blocked skills。
Hermes Agent：只能在后端激活的 skills 职责范围内组织回答。
```

### 13.1 常驻 Core Skills

所有 AI mode 都会常驻激活：

```text
cqupt-src-platform-overview
cqupt-src-ai-security-boundary
cqupt-src-ai-card-protocol
```

作用：

```text
平台语境统一
权限与安全边界统一
前端 cards/actions 协议统一
```

### 13.2 角色/模式 Skills

学生模式：

```text
cqupt-src-mall-search
cqupt-src-vulnerability-assistant
cqupt-src-learning-recommender
```

审核员模式：

```text
cqupt-src-auditor-review
```

管理员模式：

```text
cqupt-src-admin-analytics
```

### 13.3 路由输出

后端每次聊天都会计算：

```ts
{
  strategy: 'explicit_backend_role_routing',
  active: string[],
  available: string[],
  blocked: string[]
}
```

并将结果：

```text
1. 注入 system prompt，约束 Agent 本轮只使用 active skills。
2. 写入 AuditLog.metadata.skillRoute，便于审计。
3. 返回到 /api/ai/chat 响应的 skillRoute 字段，便于前端调试和可观测性。
```

### 13.4 重要边界

Hermes Agent 的 OpenAI-compatible `/v1/chat/completions` 网关当前不执行外部调用方传入的后端业务 tools，也没有通过 HTTP payload 直接指定 `--skills` 的稳定协议。因此平台采用的是：

```text
后端显式 skill routing + system prompt 注入
```

而不是让 Agent 在容器内自由 `/skill` 加载。

真实数据和权限仍以后端为准：

```text
商品、库存、积分、漏洞、学习资源、真实数据库 ID：后端实时查库。
用户身份：JWT 强制获取。
写操作：AiActionProposal + 用户确认。
审计：AiCallLog + AuditLog。
```

