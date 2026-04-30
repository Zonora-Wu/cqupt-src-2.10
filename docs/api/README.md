# API Docs

API 文档目录。当前已完成健康检查、认证登录、漏洞提交、PDF 附件上传与受控预览、证书签发与公开核验、公告管理、学习资源与靶场资源、积分商城接口初版。

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
  "email": "student@example.edu.cn"
}
```

开发环境会返回 `devCode: "123456"`，后续接入 SMTP 后移除该字段。

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

说明：当前验证码生成接口为开发版本，真实邮件发送后续接入 SMTP。

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

## 后续接口分组

```text
/api/auth                  登录、刷新令牌、邮箱验证码
/api/users                 用户资料、账号安全、准入状态
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
