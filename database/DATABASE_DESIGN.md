# CQUPT-SRC 数据库模型设计 v0.1

<!-- CQUPT-SRC-DOCS-SYNC:START -->
> 文档同步状态：2026-05-21 已按当前代码与运行环境更新。当前项目已完成认证/RBAC、漏洞全流程、PDF 附件受控预览、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心、安全答题准入、AI Gateway、邮宝前端助手、AI Knowledge Base 多轮会话沉淀、AI 评分自动流转、相似知识去重、Skill Candidate 审核与 Hermes Skill 受控安装链路。
>
> 平台 Hermes 与 CLI Hermes 是两套环境：平台后端调用 `/home/cocking/cqupt-src-hermes-linux/` 的 Docker 容器（`http://localhost:5000/v1/chat/completions`，模型配置为 DeepSeek 系列），当前 CLI 会话使用 `/home/cocking/.hermes/`。前端禁止直连模型，所有 AI 调用必须经过 NestJS AI Gateway。
>
> 关键权威文档：`docs/AI.md`、`docs/AI_KNOWLEDGE_BASE.md`、`docs/AI_SKILLS.md`、`docs/HERMES_RUNTIME.md`、`docs/api/README.md`、`database/prisma/schema.prisma`。
<!-- CQUPT-SRC-DOCS-SYNC:END -->

## 1. 设计目标

本数据库模型面向正式上线产品设计，优先满足以下目标：

1. 只允许校内用户注册，访客不入库，仅允许公开证书查询。
2. 支持统一认证码 + 密码、邮箱验证码登录，后续可接学校统一认证。
3. 用户只能拥有一个角色，但角色可以绑定多个权限点。
4. 支持 BASIC/TRUSTED/STAFF 三层通用授权等级，并通过授权来源适配不同学校。
5. 用户必须绑定邮箱并满足准入策略后才可提交漏洞：责任书签署、安全答题通过、账号状态正常。
6. 漏洞支持草稿，但提交后不可撤回。
7. 所有漏洞状态变更、敏感附件查看、审核、证书、公告、AI 调用都需要审计。
8. 附件只允许 PDF，单文件 10MB，保存哈希用于去重和审计。
9. 一个漏洞只分配一个审核员，一个漏洞最多签发一张证书。
10. AI 原始对话不直接作为长期知识复用；多轮问题解决会话进入 `AiKnowledgeConversation`，经脱敏、泛化、AI 评分、相似去重和管理员审核后才可进入知识库或 Skill Candidate。
11. 当前不做多租户，但保留单学校部署配置表，方便不同学校独立部署时替换 Logo、主题、邮箱域名、规则和证书模板。

## 2. 核心表分组

### 2.1 用户与权限

| 表 | 作用 |
|---|---|
| `users` | 校内用户账号，包含统一认证码、邮箱、学院、年级、学号、授权级别 |
| `roles` | 角色，学生、审核员、管理员 |
| `permissions` | 权限点，例如漏洞审核、证书签发、公告管理 |
| `role_permissions` | 角色默认权限 |
| `user_permission_overrides` | 用户级权限覆盖，用于“审核员证书签发权限由管理员开启” |
| `authorization_sources` | 授权来源，不同学校可配置自己的安全团队、课程、社团、白名单来源 |
| `authorization_policies` | 授权策略，定义某个授权等级可测试哪些资产范围 |
| `email_verification_codes` | 邮箱验证码 |
| `refresh_tokens` | 刷新令牌，用于正式登录态 |

用户只能绑定一个角色，即 `users.role_id`。

审核员是否能签发证书，不建议写死在角色里，使用 `user_permission_overrides` 可以做到某个审核员单独开启或关闭。

### 2.2 准入、考试、责任书

| 表 | 作用 |
|---|---|
| `security_questions` | 安全答题题库，支持单选、判断、多选，管理员维护 |
| `security_exam_attempts` | 答题尝试记录，保存分数、通过状态、题目快照和提交摘要 |
| `responsibility_agreements` | 责任书版本 |
| `responsibility_signatures` | 用户签署记录，保存版本、时间、IP、设备信息 |

提交漏洞资格建议由后端实时判断：

```text
邮箱已验证
AND 责任书已签署
AND 如果系统开启考试要求，则考试已通过
AND 用户状态正常
```

### 2.3 漏洞响应

| 表 | 作用 |
|---|---|
| `assets` | 校园资产，可选关联漏洞，并标记资产授权范围 |
| `vulnerability_reports` | 漏洞报告主体 |
| `vulnerability_attachments` | 漏洞 PDF 附件 |
| `vulnerability_events` | 漏洞状态流转与操作记录 |
| `review_assignments` | 漏洞审核员分配，一个漏洞一个审核员 |
| `review_comments` | 审核意见 |
| `retest_records` | 复测记录，可选复测 PDF |

漏洞状态机：

```text
DRAFT
  -> SUBMITTED
  -> PENDING_REVIEW
  -> NEEDS_SUPPLEMENT
  -> CONFIRMED
  -> FIXING
  -> PENDING_RETEST
  -> ARCHIVED
  -> CERTIFIED

PENDING_REVIEW / NEEDS_SUPPLEMENT / CONFIRMED
  -> REJECTED
```

业务规则：

- `DRAFT` 可编辑。
- 已提交后不可撤回。
- 每次状态变更必须写入 `vulnerability_events`。
- 访问附件必须写入 `audit_logs`。

### 2.4 证书

| 表 | 作用 |
|---|---|
| `certificates` | 电子证书，公开核验码，签发与撤销信息 |

规则：

- 一个漏洞最多一张证书，使用 `vulnerability_id @unique` 保证。
- 证书状态包含待签发、已签发、已撤销。
- 审核员和管理员都可以签发。
- 审核员能否签发由权限点控制。
- 证书撤销后不删除，只记录撤销状态和撤销原因。
- 访客证书查询只返回脱敏信息，不能返回漏洞敏感详情。

### 2.5 积分与商城

| 表 | 作用 |
|---|---|
| `point_ledger_entries` | 积分完整流水 |
| `mall_products` | 积分商城商品 |
| `mall_redemptions` | 兑换记录 |

规则：

- 漏洞积分由审核员或管理员手动确定。
- 积分调整必须写流水。
- 兑换状态：待领取、已领取、已取消。
- 校园内线下领取，不设计邮寄地址。

### 2.6 学习中心

| 表 | 作用 |
|---|---|
| `learning_resources` | 工具资源与靶场链接 |

规则：

- 前期资源和靶场不拆太细，用 `kind` 区分资源或靶场。
- 前期靶场为外部链接。
- 保留字段支持后续本地靶场实例。
- 统计下载或访问次数。

### 2.7 公告

| 表 | 作用 |
|---|---|
| `announcements` | 公告草稿、发布、下架、置顶 |

规则：

- 审核员和管理员都可以发布。
- 发布范围：全体、学生、审核员、管理员。
- 不记录阅读状态。

### 2.8 AI

| 表 | 作用 |
|---|---|
| `ai_call_logs` | AI 调用审计，保存脱敏输入摘要、输出摘要、模型、耗时和结果 |
| `ai_knowledge_entries` | 审核后的 AI Knowledge Base 条目，供后续检索与复用 |
| `ai_knowledge_capture_jobs` | 知识捕获任务队列，记录来源、状态、错误和处理结果 |
| `ai_knowledge_conversations` | 多轮会话级沉淀单元，保存脱敏总结、AI 评分、重复风险、相似知识和审核状态 |
| `ai_knowledge_conversation_turns` | 会话轮次，保存脱敏后的用户/助手消息摘要 |
| `ai_skill_candidates` | 从高质量知识条目生成的 Skill 候选，需管理员二次审核 |
| `ai_skill_install_logs` | Skill Candidate 安装记录，记录目标路径、结果和错误信息 |

隔离规则：

- 学生 AI、审核员 AI、管理员 AI 使用 `ai_space` / `role_scope` 隔离。
- 原始对话不直接变成公共知识；沉淀前必须脱敏、泛化、评分、去重。
- 评分字段包括 `overallScore`、`kbScore`、`skillScore`、`safetyScore`、`privacyRiskScore`、`confidenceScore`。
- 去重字段包括 `duplicateRiskScore`、`similarKnowledgeMatches`、`mergeSuggestion`。
- AI 对系统的任何写操作都必须进入 action proposal / 后端事务 / 审计链路。
- Skill Candidate 不等于已安装 Skill；安装到平台 Hermes skills 目录前必须管理员审批。

### 2.9 审计与系统设置

| 表 | 作用 |
|---|---|
| `audit_logs` | 审计日志 |
| `school_profiles` | 单学校部署配置 |
| `system_settings` | 系统设置 |
| `certificate_templates` | 证书背景模板、电子印章、布局 JSON 和启用版本 |

证书模板规则：

- 证书模板由管理员在系统设置中维护。
- 背景模板支持 PDF / PNG，电子印章支持 PNG。
- 每次上传背景模板会创建一个新版本，并设置为当前启用模板。
- 已签发证书后续应保存 `templateId` 和 `templateSnapshot`，避免模板变更影响历史证书。
- 真实证书 PDF 生成时，应读取当前启用模板，在模板上叠加证书编号、姓名、漏洞信息、签发日期、二维码和印章。

审计日志建议默认保留 3 年。后续如果学校有更严格要求，再改为 5 年或长期保留。

必须审计：

- 登录、退出
- 提交漏洞
- 查看敏感附件
- 审核操作
- 状态变更
- 证书签发/撤销
- 公告发布
- 用户权限变更
- 系统设置变更
- AI 调用

## 3. 权限点建议

初始权限点建议：

```text
vulnerability:create
vulnerability:read_own
vulnerability:read_all
vulnerability:review
vulnerability:retest
vulnerability:manage
attachment:read_sensitive
certificate:read
certificate:issue
certificate:revoke
announcement:manage
learning:manage
mall:manage
user:manage
role:manage
audit:read
system:manage
ai:use_student
ai:use_auditor
ai:use_admin
ai:manage_skills
```

## 4. 授权模型

为了支持多种交付模式，授权模型不再使用固定的 L1-L6/X，而是拆成三部分：

```text
角色 Role：决定用户能使用哪些功能。
授权等级 AuthorizationLevel：决定用户默认可测试的资产范围。
授权来源 AuthorizationSource：说明用户为什么获得该授权。
```

### 4.1 授权等级

| 等级 | 名称 | 适合人群 | 默认测试范围 |
|---|---|---|---|
| BASIC | 基础授权 | 普通校内学生、通过准入条件的用户 | 公开授权资产 |
| TRUSTED | 可信授权 | 安全团队、社团、实验室、课程班、专项培养对象 | 公开授权资产 + 内部授权资产 |
| STAFF | 教职工/管理授权 | 信息化办老师、安全老师、平台运营老师 | 公开授权资产 + 内部授权资产 + 专项资产 |

### 4.2 授权来源

授权来源不写死为枚举，而是使用 `authorization_sources` 表配置。

CQUPT 可配置为：

```text
蓝山安全组
红岩网校安全组
信息安全协会
安法学院相关学生
研究生导师备案
线上安全考试
信息化办教职工专项
管理员手动授权
```

其他学校可配置为：

```text
校级 SRC 运营团队
网络安全协会
网安实验室
课程班
信息中心老师
白名单导入
统一认证同步
```

### 4.3 资产范围

资产范围使用 `AssetScope`：

| 范围 | 说明 |
|---|---|
| PUBLIC | 公开授权测试资产 |
| INTERNAL | 内部授权资产 |
| SPECIAL | 专项任务资产 |

默认授权策略：

| 授权等级 | PUBLIC | INTERNAL | SPECIAL |
|---|---|---|---|
| BASIC | 允许 | 不允许 | 不允许 |
| TRUSTED | 允许 | 允许 | 不允许 |
| STAFF | 允许 | 允许 | 允许 |

这些策略写入 `authorization_policies`，后续不同学校可通过系统设置调整。

## 5. 安全注意事项

1. 前端传来的角色、权限、提交资格都不能信任，后端必须重新校验。
2. PDF 附件必须后端校验 MIME、扩展名、大小、哈希，后续应接病毒扫描。
3. 附件下载接口必须鉴权，并记录审计日志。
4. AI 调用不能保存原始敏感输入，默认只保存脱敏摘要。
5. 审计日志不能记录密码、验证码、Token、Cookie 明文。
6. 证书公开查询必须脱敏，不能返回漏洞复现细节、资产敏感信息和用户完整身份信息。
7. 用户、漏洞、证书、公告等核心数据使用软删除，避免误删审计链断裂。
