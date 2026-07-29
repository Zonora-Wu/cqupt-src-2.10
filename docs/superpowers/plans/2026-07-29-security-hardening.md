# Platform Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use focused vertical slices and verify each security boundary before moving to the next.

**Goal:** 修复功能级安全审计发现的 SSRF、会话令牌、代理 IP、限流、安全响应头、附件预览、账号枚举和公开查询风险。

**Architecture:** 后端集中提供可信请求元数据、网络出口校验和限流能力，业务模块不再自行解析不可信请求头。Refresh Token 仅通过 HttpOnly Cookie 传输并在数据库中轮换，前端只在内存与短期本地会话中处理 Access Token。高风险公开及高成本接口统一接入限流。

**Tech Stack:** NestJS 11、Express 5、Prisma 6、PostgreSQL、React 19、Vite 6。

## Global Constraints

- 保持现有角色权限和对象级授权行为。
- 不记录明文密码、验证码、API Key、Refresh Token 或漏洞附件内容。
- 本次不引入新的外部基础设施；多实例共享限流作为部署前置条件明确记录。
- 所有安全失败使用稳定、非泄密的用户提示。

---

### Task 1: Network And Runtime Boundary

**Files:**
- Create: `backend/src/common/security/outbound-url.ts`
- Create: `backend/src/common/security/security-rate-limit.service.ts`
- Modify: `backend/src/config/env.ts`
- Modify: `backend/src/main.ts`
- Modify: `backend/src/modules/ai/ai-model.service.ts`
- Test: `backend/test/security-boundaries.test.ts`

- [x] 校验 JWT、AI 加密密钥和生产环境来源配置，拒绝示例值及弱密钥。
- [x] 仅通过 Express 可信代理规则解析客户端 IP。
- [x] 添加 CSP、HSTS、frame、MIME、referrer 和 permissions 响应头。
- [x] 对用户 AI Base URL 做 DNS A/AAAA 解析及完整特殊网段拦截。
- [x] 请求前重新校验目标地址，禁用跳转并限制协议和端口。

### Task 2: Refresh Token Cookie Lifecycle

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Modify: `backend/src/modules/auth/auth.types.ts`
- Modify: `frontend/src/services/auth.ts`
- Modify: `frontend/src/services/apiClient.ts`

- [x] 登录后将 Refresh Token 写入 HttpOnly、Secure、SameSite Cookie。
- [x] 登录响应不再返回 Refresh Token。
- [x] 新增刷新接口，校验数据库哈希、状态和过期时间后执行单次轮换。
- [x] 新增退出接口并撤销当前 Refresh Token。
- [x] API 收到 401 后只自动刷新一次，失败即清理本地会话。

### Task 3: Abuse Controls

**Files:**
- Create: `backend/src/common/security/rate-limit.service.ts`
- Modify: `backend/src/app.module.ts`
- Modify: auth、chat、AI、attachments、certificates controllers

- [x] 实现有容量上限和定期清理的限流服务。
- [x] 登录、验证码和重置接口按可信 IP 与账号限流。
- [x] AI 对话、PDF 解析和附件上传按用户限流。
- [x] 证书公开查询按可信 IP 和证书编号限流。
- [x] 聊天改用统一限流服务。

### Task 4: Content And Privacy Hardening

**Files:**
- Modify: `backend/src/modules/attachments/attachments.controller.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Modify: `backend/src/modules/certificates/certificates.service.ts`

- [x] PDF 响应增加隔离 CSP、禁止缓存和下载安全头。
- [x] 密码重置验证码发送统一返回，隐藏账号存在性。
- [x] 公开证书查询只对通过限流的请求计数。

### Task 5: Verification

**Files:**
- Test: `backend/test/security-boundaries.test.ts`

- [x] 运行安全边界测试。
- [x] 运行后端 TypeScript 构建。
- [x] 运行前端定向 ESLint 和生产构建。
- [x] 检查 diff，确认无密钥、生成文件或无关修改。
