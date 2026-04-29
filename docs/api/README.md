# API Docs

API 文档目录。当前已完成健康检查、认证登录、漏洞提交、PDF 附件上传与受控预览接口初版。

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

## API 安全原则

- 所有业务接口默认需要鉴权。
- 公开接口只允许访问脱敏数据。
- 文件下载必须校验访问权限并写审计日志。
- AI 接口必须经过后端脱敏、限流和审计。
- 错误响应不能泄露内部实现。
- 后续业务接口优先使用 `JwtAuthGuard` + `PermissionsGuard`，并通过 `RequirePermissions(...)` 声明所需权限点。
