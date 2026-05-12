# AI 说明文档

本文档说明 CQUPT-SRC 平台的 AI 目标效果、当前实现进度、部署信息、接口链路、安全边界和后续规划。

## 1. 总体目标

平台 AI 不是单纯聊天机器人，而是校园漏洞响应平台中的辅助智能体。它应围绕学生、审核员、管理员三类角色，帮助完成漏洞报告整理、审核判断辅助、平台运营治理和安全学习推荐。

AI 的定位是：

- 辅助整理信息，不替代人工提交和审核。
- 辅助判断风险，不自动决定漏洞等级、积分、证书或处罚。
- 辅助学习和运营，不提供未授权攻击、绕过、持久化、凭据窃取、数据外传等内容。
- 所有关键业务动作必须由用户或管理员人工确认。

## 2. 目标效果

### 学生侧

学生端 AI 助手需要达到以下效果：

- 帮助学生检查漏洞报告是否完整。
- 根据报告内容提示缺失材料，例如影响范围、复现截图、请求响应包、修复建议、脱敏说明。
- 辅助整理漏洞标题、资产、漏洞类型、复现步骤、影响说明和修复建议。
- 根据学生提交记录、学习中心资源和靶场进度，推荐下一步学习路径。
- 提醒学生遵守授权测试边界，避免提交敏感数据、Token、Cookie、密码、身份证号等信息。
- 支持对话式问答，刷新页面或切换菜单后保留最近对话。

当前学生端已接入用户 AI 助手页，支持真实 Agent 回复、用户头像、管理员配置的 AI 头像和本地对话恢复。

### 审核员侧

审核员 AI 目标效果：

- 辅助判断报告材料是否足够复现。
- 提醒审核员关注漏洞影响面、可利用性、资产归属、重复报告和修复建议质量。
- 辅助生成审核意见草稿、补充材料要求和复测检查清单。
- 辅助总结漏洞价值，但不自动确认漏洞等级和积分。

当前后端 AI Gateway 已预留 `auditor` 模式和 `ai:use_auditor` 权限，前端审核员专用入口仍属于后续完善项。

### 管理员侧

管理员 AI 目标效果：

- 辅助生成平台运营摘要，例如漏洞趋势、高危类型分布、审核积压、修复超时风险。
- 辅助草拟公告、规则、FAQ、安全学习内容和漏洞响应规范。
- 辅助分析审计日志、异常访问和平台运行状态。
- 支持管理员配置用户端 AI 助手头像，统一平台形象。

当前后端 AI Gateway 已预留 `admin` 模式和 `ai:use_admin` 权限；管理员系统设置已支持上传 AI 助手头像。

## 3. 当前进度

截至当前版本，已完成：

- Hermes Agent 已部署在独立 Docker 容器中。
- 后端新增 AI Gateway 模块：`backend/src/modules/ai`。
- 后端提供 Agent 健康检查、AI 对话代理和 AI 助手外观读取接口。
- 后端通过 OpenAI-compatible API 调用 Hermes Agent。
- 后端对常见 Token、Cookie、密码字段做基础脱敏。
- AI 调用写入 `AuditLog`，动作为 `CALL_AI`。
- 前端用户 AI 助手页已从演示回复改为调用 `/api/ai/chat`。
- 用户 AI 助手页支持真实用户头像。
- AI 助手头像支持管理员在系统设置中上传。
- 用户端通过 `/api/ai/appearance` 读取 AI 助手头像。
- AI 对话页支持刷新页面、切换菜单后的本地对话恢复。
- AI 对话页底部输入框遮挡问题已处理，会根据输入框高度动态预留底部空间。
- 接口文档已补充 AI Gateway 和 AI 助手外观配置接口。

暂未完成或仍需增强：

- 后端 AI 调用限流。
- AI 对话历史服务端持久化。
- 审核员和管理员专用 AI 页面。
- 按漏洞报告、学习资源、公告、FAQ 等业务数据注入上下文。
- RAG/知识库索引。
- 提示词模板后台配置。
- AI 输出内容的人工确认流和引用来源展示。
- 针对不同角色的更细粒度安全策略。

## 4. 当前部署信息

Hermes Agent 当前部署在独立 Docker 容器中，不和业务后端放在同一个容器里。

```text
Agent 目录：/home/cocking/cqupt-src-hermes-linux
容器名称：hermes-agent
宿主机端口：5000
健康检查：http://localhost:5000/health
OpenAI-compatible Base URL：http://localhost:5000/v1
模型名称：hermes-agent
```

当前健康检查返回：

```json
{
  "status": "ok",
  "platform": "hermes-agent"
}
```

当前模型接口：

```text
GET http://localhost:5000/v1/models
Authorization: Bearer <API_SERVER_KEY>
```

返回模型包含：

```text
hermes-agent
```

业务后端配置在 `backend/.env`：

```env
OPENAI_BASE_URL=http://localhost:5000/v1
OPENAI_API_KEY=<API_SERVER_KEY>
OPENAI_MODEL=hermes-agent
```

如果业务后端也运行在 Docker 容器中，`localhost` 会指向后端容器自身，需要改成 Docker 网络内服务名：

```env
OPENAI_BASE_URL=http://hermes-agent:5000/v1
```

## 5. 调用链路

当前 AI 调用链路如下：

```text
前端用户 AI 助手页
  -> POST /api/ai/chat
  -> 后端 JwtAuthGuard + PermissionsGuard
  -> 后端 AI Gateway 脱敏和构造提示词
  -> Hermes Agent /v1/chat/completions
  -> 后端写入 CALL_AI 审计日志
  -> 前端展示 AI 回复
```

前端不能直接访问 Hermes Agent，也不能在浏览器暴露 `OPENAI_API_KEY`。

## 6. 相关接口

### Agent 健康检查代理

```text
GET /api/ai/health
```

用途：

- 检查后端到 Hermes Agent 的连通性。
- 返回模型列表和延迟信息。

### 用户端读取 AI 助手外观

```text
GET /api/ai/appearance
```

用途：

- 用户 AI 助手页读取管理员配置的 AI 头像。
- 未配置时返回 `avatarUrl: null`。

### AI 对话

```text
POST /api/ai/chat
```

请求示例：

```json
{
  "mode": "student",
  "message": "帮我检查这份漏洞报告还缺什么材料",
  "context": {
    "source": "user-ai-assistant"
  }
}
```

权限要求：

```text
student 模式：ai:use_student
auditor 模式：ai:use_auditor
admin 模式：ai:use_admin
```

### 管理员读取 AI 助手外观配置

```text
GET /api/system-settings/ai-appearance
```

权限要求：

```text
system:manage
```

### 管理员上传 AI 助手头像

```text
POST /api/system-settings/ai-appearance/avatar
```

表单字段：

```text
file: JPG、PNG、WebP 或 GIF 图片
```

限制：

- 最大 2MB。
- 后端校验 MIME 类型和扩展名。
- 头像以 data URL 保存到 `SystemSetting`，key 为 `ai_assistant_avatar_url`。

完整接口示例见 `docs/api/README.md`。

## 7. 前端表现

用户端 AI 助手页位于：

```text
frontend/src/pages/user/UserAIAssistant.tsx
```

当前表现：

- 空状态展示平台 AI 助手入口。
- 发送后切换为对话模式。
- 用户消息展示在右侧，使用真实用户头像；无头像时显示姓名首字。
- AI 消息展示在左侧，使用管理员配置的圆形头像；无配置时显示默认 Bot 图标。
- 输入框固定在底部。
- 消息列表会根据底部输入框高度动态留白，避免 AI 长回复被遮挡。
- 正在思考状态使用动态圆点和头像轻微缩放动画。
- 对话按当前登录用户保存在浏览器 `localStorage`，最多保留最近 80 条。

本地对话存储说明：

- 存储 key 格式：`cqupt-src-ai-conversation:<userId 或 unifiedCode>`。
- 仅用于前端恢复展示。
- 当前不上传后端，不参与审计，不作为正式业务记录。
- 后续如要做服务端历史，需要新增 AI Conversation 数据模型和清理策略。

管理员系统设置页位于：

```text
frontend/src/pages/admin/AdminSystemSettings.tsx
```

当前已新增「AI 助手」设置项，用于上传和预览 AI 助手头像。

## 8. 后端实现

AI Gateway 模块：

```text
backend/src/modules/ai/
├── ai.controller.ts
├── ai.module.ts
├── ai.service.ts
├── ai.types.ts
└── ai.validation.ts
```

主要职责：

- 校验 AI 请求参数。
- 按 `mode` 检查角色权限。
- 构造系统提示词和用户提示词。
- 对常见敏感字段做基础脱敏。
- 调用 OpenAI-compatible Agent 接口。
- 提取模型回复内容。
- 写入 `CALL_AI` 审计日志。

系统设置模块新增 AI 外观配置：

```text
backend/src/modules/system-settings/system-settings.controller.ts
backend/src/modules/system-settings/system-settings.service.ts
backend/src/modules/system-settings/system-settings.types.ts
```

主要职责：

- 管理员上传 AI 助手头像。
- 将头像配置写入 `SystemSetting`。
- 写入 `CHANGE_SYSTEM_SETTING` 审计日志。
- 为管理员设置页返回当前 AI 助手外观。

## 9. 安全边界

当前 AI 安全边界：

- 前端不能直连 Agent。
- Agent API Key 只放在后端环境变量。
- AI 请求必须经过 JWT 鉴权。
- AI 对话按模式检查权限点。
- 后端基础脱敏 Token、Cookie、密码等字段。
- AI 调用写入审计日志。
- AI 输出只做辅助，不替代人工判断。
- AI 不应引导未授权测试、绕过、隐蔽持久化、凭据窃取或数据外传。

后续需要补强：

- 请求频率限制和每日额度。
- 针对附件、漏洞详情、审计日志等上下文注入前的字段级脱敏。
- 对高风险提示词进行更严格拦截和审计。
- AI 输出加免责声明、引用来源和人工确认状态。
- 对管理员功能增加二次确认，避免 AI 直接触发系统变更。

## 10. 后续规划

短期：

- 完成审核员 AI 辅助入口。
- 完成管理员 AI 运营助手入口。
- 为漏洞报告详情页增加「AI 检查材料」按钮。
- 为学习中心增加「AI 推荐学习路径」入口。
- 增加 AI 调用限流和错误重试提示。

中期：

- 建立 AI 会话历史表，支持服务端保存、搜索和清理。
- 接入平台知识库、FAQ、规则文档、漏洞分类标准和学习资源。
- 将 AI 输出接入人工确认流程，例如审核意见草稿、公告草稿、修复建议草稿。
- 增加提示词模板管理和版本记录。

长期：

- 建设校园 SRC 知识库 RAG。
- 根据历史漏洞、资产类型和修复记录进行趋势分析。
- 为管理员提供风险态势摘要和运营周报。
- 建立 AI 安全评测集，持续测试越权建议、敏感信息泄露和错误审核建议。

## 11. 当前验收状态

当前已验证：

```text
Hermes Agent /health：200
Hermes Agent /v1/models：200，返回 hermes-agent
后端 /api/ai/health：可用
后端 /api/ai/chat：可返回 Hermes Agent 回复
后端 /api/ai/appearance：200
管理员 /api/system-settings/ai-appearance：200
backend npm run typecheck：通过
frontend npx vite build：通过
```

注意：以上状态基于当前本地开发环境。生产部署时需要重新验证 Docker 网络、环境变量、Nginx 转发、Agent 端口和密钥配置。
