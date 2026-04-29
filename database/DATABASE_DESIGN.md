# CQUPT-SRC 数据库模型设计 v0.1

## 1. 设计目标

本数据库模型面向正式上线产品设计，优先满足以下目标：

1. 只允许校内用户注册，访客不入库，仅允许公开证书查询。
2. 支持统一认证码 + 密码、邮箱验证码登录，后续可接学校统一认证。
3. 用户只能拥有一个角色，但角色可以绑定多个权限点。
4. 支持 BASIC/TRUSTED/STAFF 三层通用授权等级，并通过授权来源适配不同学校。
5. 用户必须绑定邮箱并签署责任书后才可提交漏洞，后续可叠加考试通过要求。
6. 漏洞支持草稿，但提交后不可撤回。
7. 所有漏洞状态变更、敏感附件查看、审核、证书、公告、AI 调用都需要审计。
8. 附件只允许 PDF，单文件 10MB，保存哈希用于去重和审计。
9. 一个漏洞只分配一个审核员，一个漏洞最多签发一张证书。
10. AI 对话不长期保存原始会话，只保存脱敏摘要、可复用 skill、常见问题和审计日志。
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
| `security_exam_attempts` | 只记录考试是否通过、分数、时间，不保存详细题目 |
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
| `ai_call_logs` | AI 调用审计，只保存脱敏摘要和结果摘要 |
| `ai_skills` | 从有价值对话蒸馏出的 skill |
| `ai_faq_entries` | 常见问题与复用答案 |
| `ai_action_proposals` | AI 提出的系统操作建议，必须人工确认后执行 |

隔离规则：

- 学生 AI、审核员 AI、管理员 AI 使用 `ai_space` 隔离。
- 原始对话不长期保存。
- 只保存脱敏后的输入摘要。
- AI 对系统的任何操作都必须进入 `ai_action_proposals`，由人工确认。

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
