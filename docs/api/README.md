# API Docs

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-06-01 已按当前代码、运行环境和 AI 问题会话 Phase 2 进度更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、最小上下文 + dataRequests、AI Knowledge Base 问题会话生命周期、已解决会话总结、AI+规则评分、相似聚类、管理员审核、高频高质自动入库、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型路由为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 当前仍待实现/验收：Knowledge Retrieval 命中回答、来源标注写回、turn 级点赞/点踩持久化、问题会话 fork/archive/title 接口、maintenanceStatus/retrievalPolicy、维护任务 Worker、不可变 revision 回滚、知识投毒暂停与恢复闭环。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`docs/architecture/AI_PROBLEM_SESSION_KNOWLEDGE_CAPTURE.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

API 文档目录。当前已完成健康检查、认证注册、账号中心、准入中心、漏洞提交、PDF 附件上传与受控预览、证书签发与公开核验、公告管理、学习资源与靶场资源、积分商城、AI Gateway、AI 助手外观/配额/Skill 路由、安全答题题库、AI Knowledge Base 与 Skill Candidate 接口。新版目标方案将 AI 知识沉淀升级为问题会话式链路：问题会话 API、历史会话侧栏、已解决确认、AI 回复点赞/点踩、知识聚类、自动入库和知识库来源标注均在本文件给出目标契约。

## 当前接口索引（2026-05-31）

| 模块 | 主要接口 |
|---|---|
| 健康检查 | `GET /api/health` |
| 认证 | `POST /api/auth/login/password`、`POST /api/auth/login/email-code`、`POST /api/auth/register`、`GET /api/auth/me` |
| 账号中心 | `GET /api/account/profile`、`POST /api/account/avatar`、`POST /api/account/password/change`、`POST /api/account/email/identity-code`、`POST /api/account/email/change`、`GET /api/account/audit-logs` |
| 准入 | `GET /api/access/status`、`GET /api/access/responsibility-agreement/current`、`POST /api/access/responsibility-agreement/sign` |
| 安全答题 | `GET /api/security-exam/paper`、`POST /api/security-exam/submit`；管理员题库在 `/api/system-settings/security-exam/*` |
| 漏洞 | `POST /api/vulnerabilities`、`GET /api/vulnerabilities/my`、`GET /api/vulnerabilities/:reportId`、`POST /api/vulnerabilities/:reportId/review`、`POST /api/vulnerabilities/:reportId/retest`、`POST /api/vulnerabilities/my/:reportId/supplement` |
| 附件 | `POST /api/vulnerabilities/:reportId/attachments`、`GET /api/attachments/:attachmentId/preview` |
| 证书 | `GET /api/certificates/my`、`GET /api/certificates/manage`、`POST /api/certificates`、`POST /api/certificates/:certificateId/revoke`、`GET /api/certificates/:certificateId/preview`、`GET /api/certificates/public/:certificateNo` |
| 公告/学习/商城 | `/api/announcements/*`、`/api/learning/*`、`/api/points/*`、`/api/mall/*` |
| AI Gateway | `GET /api/ai/health`、`GET /api/ai/appearance`、`GET /api/ai/quota`、`GET /api/ai/skills`、`POST /api/ai/chat`、`POST /api/ai/report-drafts`、`POST /api/ai/attachments/text`、`POST /api/ai/actions/:actionId/confirm` |
| AI 问题会话 | 已实现：`POST /api/ai/problem-sessions`、`GET /api/ai/problem-sessions/history`、`GET /api/ai/problem-sessions/active`、`GET /api/ai/problem-sessions/review-queue`、`GET /api/ai/problem-sessions/:id`、`POST /api/ai/problem-sessions/:id/heartbeat`、`POST /api/ai/problem-sessions/:id/leave`、`POST /api/ai/problem-sessions/:id/resolve`、`POST /api/ai/problem-sessions/:id/summarize`、`POST /api/ai/problem-sessions/:id/review`、`POST /api/ai/problem-sessions/:id/discard`；目标态：title/archive/fork/turn feedback |
| AI 知识沉淀 | `GET /api/ai/knowledge`、`GET /api/ai/knowledge/stats`、`GET /api/ai/knowledge/conversations`、`POST /api/ai/knowledge/conversations/:id/summarize`、`POST /api/ai/knowledge/conversations/:id/review`、`GET /api/ai/knowledge/clusters`、`POST /api/ai/knowledge/:id/review`、`POST /api/ai/knowledge/:id/feedback`、`POST /api/ai/knowledge/:id/merge` |
| Skill Candidate | `GET /api/ai/knowledge/skill-candidates`、`POST /api/ai/knowledge/skill-candidates`、`POST /api/ai/knowledge/skill-candidates/:id/review`、`POST /api/ai/knowledge/skill-candidates/:id/install` |
| 管理设置 | `GET/POST /api/system-settings/platform`、`GET/POST /api/system-settings/ai-quota`、`GET/POST /api/system-settings/registration-mode`、证书模板与 AI 外观配置接口 |

> 说明：旧版 `POST /api/access/security-exam/submit` 仅记录分数；当前真实安全答题准入使用 `GET /api/security-exam/paper` 随机组卷和 `POST /api/security-exam/submit` 后端判分。

## 当前接口

### 健康检查

```text
GET /api/health
```

响应示例：

```json
{
  "service": "cqupt-src-backend",
  "status": "ok",
  "timestamp": "2026-04-29T00:00:00.000Z"
}
```

### 统一认证码 + 密码登录

```text
POST /api/auth/login/password
```

请求示例：

```json
{
  "unifiedCode": "2025001",
  "password": "123456+-"
}
```

返回：

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "unifiedCode": "2025001",
    "email": "student@example.edu.cn",
    "name": "学生用户",
    "role": "STUDENT",
    "status": "ACTIVE",
    "permissions": ["vulnerability:create"]
  }
}
```

### 邮箱验证码登录

生成登录验证码：

```text
POST /api/auth/email-code
```

请求示例：

```json
{
  "email": "student@example.edu.cn",
  "captchaToken": "captcha_xxx"
}
```

说明：

- 发送邮箱登录验证码前必须先完成滑块验证，滑块用途为 `LOGIN_EMAIL_CODE`。
- 登录验证码有效期 10 分钟。
- 同一邮箱 60 秒内不能重复发送，10 分钟内最多发送 5 次。
- 发送新验证码后，旧的未使用登录验证码会自动失效。
- 开发环境会返回 `devCode: "123456"`，生产接入 SMTP 后移除该字段。

```text
POST /api/auth/login/email-code
```

请求示例：

```json
{
  "email": "student@example.edu.cn",
  "code": "123456"
}
```

说明：登录时只消费 `LOGIN` 用途验证码，且验证码只能使用一次。当前本地开发环境返回固定 `devCode`，生产环境应接入 SMTP 发送真实邮件。

### 注册邮箱验证码

注册验证码发送前需要先完成滑块验证。

生成滑块挑战：

```text
POST /api/captcha/slider/challenge
```

请求示例：

```json
{
  "purpose": "REGISTER_EMAIL_CODE"
}
```

返回示例：

```json
{
  "challengeId": "cap_xxx",
  "answerHintRatio": 0.7342,
  "purpose": "REGISTER_EMAIL_CODE",
  "expiresIn": 120
}
```

校验滑块轨迹：

```text
POST /api/captcha/slider/verify
```

请求示例：

```json
{
  "challengeId": "cap_xxx",
  "purpose": "REGISTER_EMAIL_CODE",
  "offsetRatio": 0.734,
  "track": [
    { "x": 0, "y": 0, "t": 0 },
    { "x": 0.18, "y": 0.52, "t": 120 },
    { "x": 0.73, "y": 0.49, "t": 980 }
  ]
}
```

返回示例：

```json
{
  "captchaToken": "captcha_xxx",
  "expiresIn": 300
}
```

说明：

- challenge 有效期 2 分钟。
- 后端校验滑动目标、基础耗时、轨迹距离和明显异常回退；前端交互统一为“向右滑动完成验证”。
- `captchaToken` 有效期 5 分钟，且只能使用一次。
- 当前支持用途：`LOGIN_EMAIL_CODE`、`REGISTER_EMAIL_CODE`。
- 一期使用数据库临时表保存挑战和 token，二期可迁移到 Redis 并升级为图片拼图。

```text
POST /api/auth/register/email-code
```

请求示例：

```json
{
  "email": "new-student@cqupt.edu.cn",
  "captchaToken": "captcha_xxx"
}
```

说明：

- 仅允许校内邮箱域名注册。
- 当前允许域名来自 `SCHOOL_EMAIL_DOMAINS`、学校配置 `SchoolProfile.emailDomain`，并兼容本地开发域名。
- 开发环境会返回 `devCode: "123456"`，生产接入 SMTP 后移除。

### 学生注册

```text
POST /api/auth/register
```

请求示例：

```json
{
  "name": "张三",
  "unifiedCode": "2026001",
  "email": "new-student@cqupt.edu.cn",
  "code": "123456",
  "college": "网络空间安全与信息法学院",
  "identityText": "本科生",
  "studentNo": "2026001",
  "grade": "2026",
  "password": "abc123+-"
}
```

返回：同登录接口，注册成功后自动签发 access token 和 refresh token。

说明：

- 新注册账号默认为学生角色 `STUDENT`。
- 邮箱验证码验证通过后会设置 `emailVerifiedAt`。
- 注册成功后账号状态为 `ACTIVE`，可以登录平台。
- 漏洞提交仍需要满足责任书签署和安全答题等准入条件。
- 注册会写入 `AuditLog`，动作为 `MANAGE_USER`，metadata.action 为 `self_register`。

### 当前用户

```text
GET /api/auth/me
```

请求头：

```text
Authorization: Bearer <accessToken>
```

返回示例：

```json
{
  "id": "...",
  "unifiedCode": "2025001",
  "email": "student@example.edu.cn",
  "name": "学生用户",
  "role": "STUDENT",
  "status": "ACTIVE",
  "permissions": [
    "ai:use_student",
    "certificate:read",
    "vulnerability:create",
    "vulnerability:read_own"
  ],
  "tokenType": "access"
}
```

说明：

- 该接口需要 access token。
- 前端刷新页面后会调用该接口校验登录态。
- token 无效、过期、用户被禁用时会返回 401。

### 账号中心资料

```text
GET /api/account/profile
```

请求头：

```text
Authorization: Bearer <accessToken>
```

返回当前用户账号资料、账号安全状态和业务统计：

- 姓名、统一认证码、邮箱、学院、年级、身份、角色、授权级别。
- 邮箱验证状态、责任书签署状态、安全答题记录。
- 累计提交、有效漏洞、当前积分、证书数量。

说明：该接口用于个人中心、提交漏洞前提示和用户首页数据展示。

### 修改密码

```text
POST /api/account/password/change
```

请求示例：

```json
{
  "oldPassword": "123456+-",
  "newPassword": "newPass123+-"
}
```

说明：

- 需要校验原密码。
- 新密码需满足强度要求，且不能与原密码相同。
- 修改成功后会撤销当前账号未失效的 refresh token，其他设备需要重新登录。
- 操作写入 `AuditLog`，动作为 `MANAGE_USER`，metadata.action 为 `self_change_password`。

### 修改邮箱

发送新邮箱验证码：

```text
POST /api/account/email/code
```

请求示例：

```json
{
  "newEmail": "new-student@cqupt.edu.cn"
}
```

确认修改邮箱：

```text
POST /api/account/email/change
```

请求示例：

```json
{
  "newEmail": "new-student@cqupt.edu.cn",
  "code": "123456"
}
```

说明：

- 新邮箱必须是校内邮箱，且不能被其他账号绑定。
- 开发环境会返回 `devCode: "123456"`，生产接入 SMTP 后移除。
- 修改成功会更新 `emailVerifiedAt`，并写入审计日志。

### 提交准入状态

```text
GET /api/access/status
```

请求头：

```text
Authorization: Bearer <accessToken>
```

返回示例：

```json
{
  "canSubmitVulnerability": false,
  "authorizationLevel": "BASIC",
  "emailVerified": true,
  "responsibilityAgreementRequired": true,
  "responsibilitySigned": false,
  "securityExamRequired": true,
  "securityExamPassed": false,
  "examThreshold": 80,
  "missingRequirements": ["请先签署当前版本责任书", "请先通过安全准入考试"]
}
```

说明：

- 该接口与漏洞提交接口共用同一套后端准入策略。
- 前端可以先展示缺失条件，但最终以 `POST /api/vulnerabilities` 的后端判断为准。

### 当前责任书与签署

查看当前激活责任书：

```text
GET /api/access/responsibility-agreement/current
```

签署当前责任书：

```text
POST /api/access/responsibility-agreement/sign
```

请求示例：

```json
{
  "deviceFingerprint": "browser-device-fingerprint"
}
```

说明：

- 责任书签署会记录版本、时间、IP、User-Agent 和可选设备指纹。
- 重复签署当前版本会更新签署时间和设备信息。
- 操作写入 `AuditLog`，metadata.action 为 `sign_responsibility_agreement`。

### 安全准入答题记录

```text
POST /api/access/security-exam/submit
```

请求示例：

```json
{
  "score": 86
}
```

说明：

- 后端只记录分数和是否通过，不保存具体题目与答案。
- 通过阈值默认 80，可通过系统设置 `security.exam.threshold` 调整。
- 是否强制安全答题由系统设置 `security.exam.required` 控制。
- 操作写入 `AuditLog`，metadata.action 为 `submit_security_exam`。

## 后续接口分组

```text
/api/auth                  登录、刷新令牌、邮箱验证码
/api/account               当前用户资料、账号安全、邮箱修改
/api/access                责任书、安全答题、漏洞提交准入状态
/api/users                 管理员用户管理
/api/roles                 角色与权限
/api/vulnerabilities       漏洞提交、列表、详情、状态流转
/api/attachments           PDF 附件上传和受控下载
/api/reviews               审核员审核、复测、归档
/api/certificates          证书签发、撤销、公开核验
/api/announcements         公告管理与公告列表
/api/learning              学习资源与靶场链接
/api/points                积分流水、积分商城、兑换记录
/api/audit-logs            审计日志
/api/ai                    AI 解析、AI 辅助、skill、FAQ
/api/system-settings       系统设置
```

### AI Gateway

AI 接口只允许前端调用后端 `/api/ai/*`，后端再代理 Hermes Agent。前端不能直连 `http://localhost:5000`。

当前 Agent 部署约定：

```text
Agent 容器：hermes-agent
宿主机健康检查：http://localhost:5000/health
OpenAI-compatible Base URL：http://localhost:5000/v1
模型：hermes-agent
后端环境变量：OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL
```

检查后端到 Hermes Agent 的连通性：

```text
GET /api/ai/health
```

请求头：

```text
Authorization: Bearer <accessToken>
```

返回示例：

```json
{
  "ok": true,
  "latencyMs": 42,
  "models": {
    "object": "list",
    "data": [
      {
        "id": "hermes-agent",
        "object": "model",
        "owned_by": "hermes"
      }
    ]
  }
}
```

读取用户端 AI 助手外观：

```text
GET /api/ai/appearance
```

请求头：

```text
Authorization: Bearer <accessToken>
```

返回示例：

```json
{
  "avatarUrl": "data:image/png;base64,..."
}
```

说明：

- 用户端 AI 助手页使用该接口读取管理员配置的助手头像。
- 未配置头像时返回 `avatarUrl: null`，前端显示默认 Bot 图标。
- 头像展示统一为圆形。
- 该接口只返回展示配置，不暴露上游 Agent 地址或 API Key。

发送学生 AI 对话：

```text
POST /api/ai/chat
```

请求示例：

```json
{
  "mode": "student",
  "sessionId": "cuid_problem_session_xxx",
  "message": "帮我检查这份漏洞报告还缺什么材料",
  "context": {
    "source": "user-ai-assistant"
  }
}
```

说明：

- `sessionId` 是新版问题会话式知识沉淀的会话 ID。
- 用户每次进入 AI 助手默认创建新的问题会话。
- 后端必须校验 `sessionId` 属于当前 JWT 用户。
- 未带 `sessionId` 时，后端可以为兼容旧前端临时创建会话，但正式前端应始终传入。

返回示例：

```json
{
  "mode": "student",
  "sessionId": "cuid_problem_session_xxx",
  "userTurnId": "turn_user_xxx",
  "assistantTurnId": "turn_assistant_xxx",
  "content": "这份报告建议补充影响范围、复现截图和修复建议。",
  "usedKnowledge": true,
  "knowledgeSources": [
    {
      "id": "knowledge_xxx",
      "title": "漏洞报告补充材料写作清单",
      "sourceType": "PLATFORM_KB",
      "confidence": 0.91,
      "status": "APPROVED"
    }
  ],
  "knowledgeHitIds": ["hit_xxx"],
  "response": {
    "id": "chatcmpl_xxx",
    "object": "chat.completion",
    "choices": []
  }
}
```

权限要求：

```text
student: ai:use_student
auditor: ai:use_auditor
admin: ai:use_admin
```

说明：

- 后端按 OpenAI-compatible API 调用 Hermes Agent，读取 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`。
- 后端本机运行默认使用 `OPENAI_BASE_URL=http://localhost:5000/v1`。
- 若后端也运行在 Docker 容器中，应使用 Docker 网络服务名，例如 `OPENAI_BASE_URL=http://hermes-agent:5000/v1`。
- 默认模型为 `hermes-agent`，对应 `OPENAI_MODEL=hermes-agent`。
- 后端会对常见 Token、Cookie、密码字段做基础脱敏，并写入 AI 审计日志。
- 新版知识沉淀不依赖浏览器本地聊天历史。前端可以继续本地缓存最近消息用于显示恢复，但平台知识沉淀以后端 `AiProblemSession` 和脱敏 turns 为准。
- 如果 `usedKnowledge=true`，前端必须在 AI 回复框底部展示“本回答参考了平台知识库”的来源标注。
- 当前已实现的 `/api/ai/chat` 会返回 `sessionId`、`userTurnId`、`assistantTurnId` 和脱敏后的 turn 记录，用于问题会话沉淀。
- `usedKnowledge`、`knowledgeSources`、`knowledgeHitIds` 与 turn 级点赞/点踩持久化属于 Knowledge Retrieval / Feedback 目标态；前端不应把 knowledgeId 当作可信评分对象。

### AI 问题会话

当前已实现接口：`POST /api/ai/problem-sessions`、`GET /api/ai/problem-sessions/active`、`GET /api/ai/problem-sessions/history`、`GET /api/ai/problem-sessions/review-queue`、`GET /api/ai/problem-sessions/:id`、`POST /api/ai/problem-sessions/:id/heartbeat`、`POST /api/ai/problem-sessions/:id/leave`、`POST /api/ai/problem-sessions/:id/resolve`、`POST /api/ai/problem-sessions/:id/summarize`、`POST /api/ai/problem-sessions/:id/review`、`POST /api/ai/problem-sessions/:id/discard`。

目标态但当前未实现或未验收接口：`PATCH /api/ai/problem-sessions/:id/title`、`POST /api/ai/problem-sessions/:id/archive`、`POST /api/ai/problem-sessions/:id/fork`、`POST /api/ai/problem-sessions/:id/turns/:turnId/feedback`。

创建新的问题会话：

```text
POST /api/ai/problem-sessions
```

请求示例：

```json
{
  "mode": "student",
  "initialQuestion": "SQL 注入靶场启动失败怎么办？"
}
```

返回示例：

```json
{
  "sessionId": "cuid_problem_session_xxx",
  "status": "ACTIVE",
  "startedAt": "2026-05-31T10:00:00.000Z"
}
```

查询当前用户历史问题会话，用于 AI 助手左侧侧栏：

```text
GET /api/ai/problem-sessions/history?limit=30
```

返回示例：

```json
{
  "items": [
    {
      "sessionId": "cuid_problem_session_xxx",
      "title": "SQL 注入靶场启动失败排查",
      "status": "RESOLVED",
      "preview": "最后通过更换 8080 端口解决",
      "lastActiveAt": "2026-05-31T10:18:00.000Z",
      "turnCount": 8,
      "usedKnowledge": true,
      "feedbackSummary": {
        "upCount": 3,
        "downCount": 0
      },
      "knowledgeEntryId": "knowledge_xxx"
    }
  ],
  "nextCursor": null
}
```

说明：

- 后端按当前 JWT 用户过滤，前端不得传 `userId`。
- 历史列表只返回轻量摘要，不返回完整 turns。
- 当前实现支持 `limit`；`cursor`、`q`、多状态过滤属于目标态。
- 左侧历史会话只作为恢复/查看入口，不自动注入当前新会话上下文。
- 已结束会话如果继续追问，目标态应 fork 新 session；当前后端 fork 接口尚未实现。

查询当前活跃或等待确认的问题会话：

```text
GET /api/ai/problem-sessions/active
```

返回示例：

```json
{
  "sessionId": "cuid_problem_session_xxx",
  "status": "AWAITING_RESOLUTION",
  "shouldAskResolution": true,
  "inactiveMinutes": 18,
  "previewTitle": "SQL 注入靶场启动失败排查"
}
```

心跳：

```text
POST /api/ai/problem-sessions/:id/heartbeat
```

离开 AI 页面：

```text
POST /api/ai/problem-sessions/:id/leave
```

确认问题已解决：

```text
POST /api/ai/problem-sessions/:id/resolve
```

请求示例：

```json
{
  "resolved": true,
  "allowKnowledgeCapture": true,
  "userOutcomeNote": "最后发现是 8080 端口被占用了，换端口后解决"
}
```

说明：

- 只有当前 JWT 用户自己的 session 可以 resolve。
- `allowKnowledgeCapture=true` 才进入知识沉淀候选。
- 后端会脱敏 `userOutcomeNote`。
- resolve 后触发会话总结、AI + 规则评分、相似知识去重和管理员审核或自动入库判定。

丢弃本次会话：

```text
POST /api/ai/problem-sessions/:id/discard
```

请求示例：

```json
{
  "reason": "问题未解决，不沉淀"
}
```

目标态：基于历史会话创建新问题会话：

```text
POST /api/ai/problem-sessions/:id/fork
```

请求示例：

```json
{
  "message": "我想基于上次端口占用的问题继续问 Docker 场景",
  "mode": "student"
}
```

返回示例：

```json
{
  "sessionId": "cuid_new_problem_session_xxx",
  "forkedFromSessionId": "cuid_problem_session_xxx",
  "status": "ACTIVE"
}
```

目标态：提交某条 AI 回复的点赞/点踩：

```text
POST /api/ai/problem-sessions/:id/turns/:turnId/feedback
```

请求示例：

```json
{
  "rating": "DOWN",
  "reasonCode": "OUTDATED",
  "reasonText": "这个靶场现在已经不用 docker-compose 这个命令启动了"
}
```

返回示例：

```json
{
  "turnId": "turn_assistant_xxx",
  "rating": "DOWN",
  "knowledgeHitIds": ["hit_xxx"],
  "knowledgeFeedbackUpdated": true,
  "requiresReview": true
}
```

说明：

- `rating` 可取 `UP`、`DOWN`、`CLEARED`。
- 后端必须校验 session 和 turn 属于当前用户，且 turn.role 为 assistant。
- 使用平台知识库的回复，反馈应同步到 `AiKnowledgeHit` 和知识条目反馈汇总。
- 未使用知识库的回复，反馈只作为本次问题会话质量信号。
- 安全风险类点踩应触发知识条目暂停直接回答或进入安全复核。

### 提交漏洞

```text
POST /api/vulnerabilities
```

请求头：

```text
Authorization: Bearer <accessToken>
```

权限要求：

```text
vulnerability:create
```

准入要求：

- 用户状态正常
- 邮箱已验证
- 已签署当前激活版本责任书
- 如果系统开启安全考试要求，则需要已通过考试

请求示例：

```json
{
  "title": "某系统存在越权访问漏洞",
  "assetName": "example.cqupt.edu.cn",
  "ownerUnit": "信息化办公室",
  "selfSeverity": "MEDIUM",
  "vulnerabilityType": "权限绕过",
  "assetUrl": "https://example.cqupt.edu.cn/demo",
  "requestPacket": "GET /demo HTTP/1.1",
  "detailMarkdown": "## 【漏洞标题】\n某系统存在越权访问漏洞\n\n## 【复现步骤】\n1. 登录普通账号。\n2. 访问越权地址。"
}
```

返回示例：

```json
{
  "id": "...",
  "reportNo": "CQUPT-SRC-20260429-AE9T7Z",
  "status": "SUBMITTED",
  "submittedAt": "2026-04-29T09:00:00.000Z",
  "title": "某系统存在越权访问漏洞"
}
```

说明：

- 当前接口提交漏洞主体和 Markdown 详情。
- 如需上传 PDF 附件，前端会先创建漏洞报告，再调用附件上传接口。
- 提交成功会写入 `VulnerabilityReport`、`VulnerabilityEvent` 和 `AuditLog`。

### 我的漏洞列表

```text
GET /api/vulnerabilities/my
```

请求头：

```text
Authorization: Bearer <accessToken>
```

权限要求：

```text
vulnerability:read_own
```

返回内容：

- 当前登录用户提交的漏洞报告。
- 报告编号、标题、资产、责任单位、自评等级、最终等级、状态、积分、更新时间。
- PDF 附件摘要：附件 id、文件名、大小、上传时间。
- 当前用户漏洞统计：累计提交、待处理、已确认、需补充。

说明：

- 只返回当前用户自己的漏洞。
- 附件只返回展示元数据，不返回 MinIO 对象 key。
- PDF 预览仍需调用受控预览接口。

### 审核员漏洞审核队列

```text
GET /api/vulnerabilities/review-queue
```

请求头：

```text
Authorization: Bearer <accessToken>
```

权限要求：

```text
vulnerability:review
```

返回内容：

- 所有非草稿漏洞报告。
- 提交人基础信息、漏洞详情、复现步骤、影响评估、修复建议、请求包。
- PDF 附件摘要。
- 审核队列统计：待初审、审核中、待补充、已确认、总数。

### 审核漏洞

```text
POST /api/vulnerabilities/:reportId/review
```

请求头：

```text
Authorization: Bearer <accessToken>
Content-Type: application/json
```

权限要求：

```text
vulnerability:review
```

请求示例：

```json
{
  "decision": "CONFIRM",
  "finalSeverity": "HIGH",
  "points": 500,
  "note": "经复现确认漏洞有效，影响范围明确，建议进入修复流程。"
}
```

支持的 `decision`：

- `CONFIRM`：确认有效，状态变为 `CONFIRMED`，可写入最终等级和积分流水。
- `NEEDS_SUPPLEMENT`：要求补充材料，状态变为 `NEEDS_SUPPLEMENT`。
- `REJECT`：驳回报告，状态变为 `REJECTED`。

说明：

- 每次审核会写入 `ReviewComment`、`VulnerabilityEvent` 和 `AuditLog`。
- 确认有效且积分大于 0 时会写入 `PointLedgerEntry`。
- 审核分配会写入或更新 `ReviewAssignment`。

### 上传漏洞 PDF 附件

```text
POST /api/vulnerabilities/:reportId/attachments
```

请求头：

```text
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

表单字段：

```text
file: PDF 文件
```

安全校验：

- 仅允许报告提交本人上传。
- 仅支持 PDF。
- 单个文件不超过 10MB。
- 后端同时校验扩展名、MIME 类型和 PDF magic bytes：`%PDF-`。
- 后端计算 SHA-256 并写入数据库。
- 文件保存到 MinIO，数据库只保存对象 key 与元数据。

返回示例：

```json
{
  "id": "att_xxx",
  "originalName": "report.pdf",
  "previewUrl": "/api/attachments/att_xxx/preview",
  "sha256": "...",
  "sizeBytes": 123456,
  "uploadedAt": "2026-04-29T09:00:00.000Z"
}
```

### 预览 PDF 附件

```text
GET /api/attachments/:attachmentId/preview
```

请求头：

```text
Authorization: Bearer <accessToken>
```

访问规则：

- 漏洞提交本人可以预览。
- 拥有 `attachment:read_sensitive` 权限的审核员和管理员可以预览。
- 每次预览都会写入 `AuditLog`，动作为 `VIEW_SENSITIVE_ATTACHMENT`。

响应：

```text
Content-Type: application/pdf
Content-Disposition: inline
```

### AI 助手外观配置

管理员读取当前 AI 助手外观：

```text
GET /api/system-settings/ai-appearance
```

权限要求：

```text
system:manage
```

返回示例：

```json
{
  "avatarUrl": "data:image/png;base64,..."
}
```

上传 AI 助手头像：

```text
POST /api/system-settings/ai-appearance/avatar
```

权限要求：

```text
system:manage
```

表单字段：

```text
file: JPG、PNG、WebP 或 GIF 图片
```

返回示例：

```json
{
  "avatarUrl": "data:image/png;base64,..."
}
```

说明：

- 文件最大 2MB。
- 后端会校验文件 MIME 类型和扩展名。
- 头像以 data URL 形式保存到 `SystemSetting`，key 为 `ai_assistant_avatar_url`。
- 上传成功后写入 `AuditLog`，动作为 `CHANGE_SYSTEM_SETTING`。
- 用户端通过 `GET /api/ai/appearance` 读取该配置。

### 当前启用证书模板

```text
GET /api/system-settings/certificate-template/active
```

权限要求：

```text
system:manage
```

返回当前启用的证书模板摘要。不会返回 MinIO 对象 key。

### 上传证书背景模板

```text
POST /api/system-settings/certificate-template/background
```

权限要求：

```text
system:manage
```

表单字段：

```text
file: PDF 或 PNG 文件
```

说明：

- 支持真实 PDF 或 PNG。
- 最大 20MB。
- 上传成功后会创建一个新的模板版本，并设置为当前启用模板。
- 旧模板会自动停用，但历史证书后续会通过模板快照保持签发时效果。
- 操作写入 `AuditLog`，动作为 `CHANGE_SYSTEM_SETTING`。

### 上传电子印章

```text
POST /api/system-settings/certificate-template/seal
```

权限要求：

```text
system:manage
```

表单字段：

```text
file: PNG 文件
```

说明：

- 仅支持真实 PNG。
- 最大 5MB。
- 必须先存在当前启用证书背景模板。
- 上传成功后会绑定到当前启用模板。
- 操作写入 `AuditLog`，动作为 `CHANGE_SYSTEM_SETTING`。

### 证书管理列表

```text
GET /api/certificates/manage
```

权限要求：

```text
vulnerability:manage
```

返回内容：

- 已确认并拥有最终等级的漏洞会进入证书队列。
- 未签发漏洞显示为 `待签发`。
- 已签发或已撤销漏洞会返回对应证书状态、核验码、签发人、签发时间和贡献说明。

### 我的证书

```text
GET /api/certificates/my
```

权限要求：

```text
certificate:read
```

返回当前登录用户获得的证书列表。

### 签发证书

```text
POST /api/certificates
```

权限要求：

```text
certificate:issue
```

请求示例：

```json
{
  "vulnerabilityId": "...",
  "contribution": "发现并规范提交校园资产中的高价值漏洞，协助学校完善安全治理能力。",
  "publicVerify": true
}
```

规则：

- 关联漏洞必须存在且未删除。
- 漏洞必须已确认，并已经确定最终等级。
- 一个漏洞最多签发一张证书。
- 必须先在系统设置中上传并启用证书模板。
- 后端会生成证书编号、核验码和真实 PDF 文件，并保存到 MinIO。
- PDF 会读取当前启用的 PDF/PNG 背景模板，叠加证书编号、核验码、获得者姓名、漏洞标题、报告编号、最终等级、影响资产、日期、贡献说明，并嵌入电子印章。
- 中文字体可通过后端环境变量 `CERTIFICATE_FONT_PATH` 指定。Ubuntu 云服务器建议安装 Noto CJK 字体并配置字体路径。
- 操作写入 `Certificate`、`VulnerabilityEvent` 和 `AuditLog`。

### 撤销证书

```text
POST /api/certificates/:certificateId/revoke
```

权限要求：

```text
certificate:revoke
```

请求示例：

```json
{
  "reason": "证书信息需要重新核对"
}
```

说明：

- 撤销后公开核验不可用。
- 撤销原因会进入审计日志和漏洞流程事件。

### 预览证书 PDF

```text
GET /api/certificates/:certificateId/preview
```

权限要求：

```text
certificate:read
```

访问规则：

- 证书获得者本人可以预览。
- 拥有 `vulnerability:manage` 权限的审核员和管理员可以预览其他用户证书。
- 响应为 `application/pdf`，通过后端从 MinIO 读取，不暴露对象 key。

### 公开核验证书

```text
GET /api/certificates/public/:certificateNo
```

说明：

- 该接口不需要登录。
- 仅返回可公开核验的有效证书。
- 返回获得者姓名与统一认证码的脱敏信息，不返回漏洞 URL、复现步骤、附件、审核备注等敏感内容。

### 公开公告列表

```text
GET /api/announcements/public
```

说明：

- 该接口不需要登录。
- 仅返回 `PUBLISHED` 且发布范围为 `ALL` 的公告。
- 按置顶、发布时间倒序排列。

### 公开公告详情

```text
GET /api/announcements/public/:id
```

说明：

- 该接口不需要登录。
- 仅允许查看公开发布公告详情。

### 登录用户可见公告列表

```text
GET /api/announcements/visible
```

请求头：

```text
Authorization: Bearer <accessToken>
```

说明：

- 学生可见：`ALL`、`STUDENTS`。
- 审核员可见：`ALL`、`AUDITORS`。
- 管理员可见：`ALL`、`ADMINS`。
- 仅返回 `PUBLISHED` 公告。

### 登录用户可见公告详情

```text
GET /api/announcements/visible/:id
```

请求头：

```text
Authorization: Bearer <accessToken>
```

### 公告管理列表

```text
GET /api/announcements/manage
```

权限要求：

```text
announcement:manage
```

返回所有未删除公告，包括草稿、已发布和已下架。

### 新建公告草稿

```text
POST /api/announcements
```

权限要求：

```text
announcement:manage
```

请求示例：

```json
{
  "title": "关于规范漏洞报告附件提交格式的通知",
  "category": "规则更新",
  "range": "全体用户",
  "pinned": true,
  "summary": "漏洞报告附件建议使用 PDF 格式，截图需去除无关个人信息。",
  "content": "公告正文..."
}
```

说明：

- 新建后默认为草稿。
- 操作会写入审计日志。

### 修改公告

```text
PATCH /api/announcements/:id
```

权限要求：

```text
announcement:manage
```

说明：

- 可修改标题、分类、发布范围、置顶状态、摘要和正文。
- 操作会写入审计日志。

### 发布公告

```text
POST /api/announcements/:id/publish
```

权限要求：

```text
announcement:manage
```

说明：

- 状态变为 `PUBLISHED`。
- 写入发布时间。
- 操作会写入审计日志，metadata.action 为 `publish`。

### 下线公告

```text
POST /api/announcements/:id/offline
```

权限要求：

```text
announcement:manage
```

说明：

- 状态变为 `OFFLINE`。
- 写入下线时间。
- 普通用户和访客不再可见。
- 操作会写入审计日志，metadata.action 为 `offline`。

### 登录用户学习资源列表

```text
GET /api/learning
```

请求头：

```text
Authorization: Bearer <accessToken>
```

说明：

- 访客不可访问真实学习资源和外部链接。
- 登录用户可查看已上架、未删除的学习资料与靶场资源。
- 返回资源标题、类型、分类、说明、外部链接和访问次数。

### 访问学习资源 / 进入靶场

```text
POST /api/learning/:id/click
```

请求头：

```text
Authorization: Bearer <accessToken>
```

说明：

- 仅允许访问已上架资源。
- 后端会将 `downloadCount` 加 1，并返回外部链接。
- 当前阶段资源均为外部链接，不涉及 MinIO 文件下载。

### 学习资源管理列表

```text
GET /api/learning/manage
```

权限要求：

```text
learning:manage
```

说明：

- 当前仅管理员拥有 `learning:manage`。
- 审核员不管理学习资源。
- 返回所有未删除学习资源，包括已上架和已下架。

### 新建学习资源

```text
POST /api/learning
```

权限要求：

```text
learning:manage
```

请求示例：

```json
{
  "kind": "RESOURCE",
  "category": "工具资源",
  "title": "Burp Suite Community 下载入口",
  "description": "Web 请求代理、重放与漏洞验证常用工具。",
  "externalUrl": "https://portswigger.net/burp/communitydownload",
  "active": true
}
```

字段说明：

- `kind`：`RESOURCE` 或 `RANGE`。
- `category`：资源分类，例如 `工具资源`、`文档资料`、`Web靶场`。
- `externalUrl`：必须是 `http://` 或 `https://` 开头的有效地址。

### 修改学习资源

```text
PATCH /api/learning/:id
```

权限要求：

```text
learning:manage
```

说明：可修改类型、分类、标题、说明、外部链接和上架状态。操作写入审计日志。

### 上架学习资源

```text
POST /api/learning/:id/enable
```

权限要求：

```text
learning:manage
```

### 下架学习资源

```text
POST /api/learning/:id/disable
```

权限要求：

```text
learning:manage
```

### 删除学习资源

```text
DELETE /api/learning/:id
```

权限要求：

```text
learning:manage
```

说明：

- 删除为软删除。
- 创建、修改、上架、下架、删除都会写入 `AuditLog`，动作为 `MANAGE_LEARNING_RESOURCE`。

### 积分概览

```text
GET /api/points/summary
```

权限要求：

```text
point:read
```

返回当前用户可用积分、累计收入、累计支出、调整积分和待领取兑换数。

### 积分流水

```text
GET /api/points/ledger
```

权限要求：

```text
point:read
```

说明：积分以流水为准，漏洞奖励、商城兑换、取消返还都会写入 `PointLedgerEntry`。

### 用户商品列表

```text
GET /api/mall/products
```

请求头：

```text
Authorization: Bearer <accessToken>
```

说明：

- 仅登录用户可访问。
- 只返回已上架、未删除商品。
- 当前商品兑换采用蓝山工作室线下领取，不提供邮寄。

### 用户提交兑换申请

```text
POST /api/mall/redemptions
```

权限要求：

```text
mall:redeem
```

请求示例：

```json
{
  "productId": "mall_demo_notebook"
}
```

事务规则：

- 校验商品已上架、库存充足。
- 校验用户可用积分充足。
- 校验每人限兑数量。
- 扣减库存。
- 创建兑换订单。
- 创建积分支出流水。
- 创建兑换状态事件。

### 用户兑换记录

```text
GET /api/mall/redemptions/my
```

权限要求：

```text
mall:redeem
```

### 管理员商品列表

```text
GET /api/mall/manage/products
```

权限要求：

```text
mall:manage
```

### 管理员新建商品

```text
POST /api/mall/manage/products
```

权限要求：

```text
mall:manage
```

请求示例：

```json
{
  "name": "CQUPT-SRC 定制笔记本",
  "category": "实体奖励",
  "description": "用于记录漏洞复现过程、学习笔记和靶场训练思路。",
  "imageUrl": "",
  "pointsCost": 280,
  "stock": 18,
  "status": "ACTIVE",
  "perUserLimit": 2,
  "pickupLocation": "蓝山工作室",
  "pickupInstructions": "兑换成功后请携带校园卡或有效身份证明前往蓝山工作室领取。",
  "sortOrder": 80
}
```

### 管理员修改商品

```text
PATCH /api/mall/manage/products/:id
```

权限要求：

```text
mall:manage
```

### 商品上架 / 下架 / 删除

```text
POST   /api/mall/manage/products/:id/activate
POST   /api/mall/manage/products/:id/deactivate
DELETE /api/mall/manage/products/:id
```

权限要求：

```text
mall:manage
```

说明：

- 库存为 0 的商品不能上架。
- 存在待领取兑换记录的商品不能删除。
- 删除为软删除。

### 管理员兑换处理列表

```text
GET /api/mall/manage/redemptions
```

权限要求：

```text
mall:manage
```

### 确认线下领取

```text
POST /api/mall/manage/redemptions/:id/complete
```

权限要求：

```text
mall:manage
```

说明：仅待领取订单可确认领取，确认后状态变为 `COMPLETED`。

### 取消兑换

```text
POST /api/mall/manage/redemptions/:id/cancel
```

权限要求：

```text
mall:manage
```

说明：

- 仅待领取订单可取消。
- 取消会通过事务返还积分、恢复库存、写入兑换事件。
- 商品管理、确认领取、取消兑换都会写入 `AuditLog`，动作为 `MANAGE_MALL`。

## API 安全原则

- 所有业务接口默认需要鉴权。
- 公开接口只允许访问脱敏数据。
- 文件下载必须校验访问权限并写审计日志。
- AI 接口必须经过后端脱敏、限流和审计。
- 错误响应不能泄露内部实现。
- 后续业务接口优先使用 `JwtAuthGuard` + `PermissionsGuard`，并通过 `RequirePermissions(...)` 声明所需权限点。
