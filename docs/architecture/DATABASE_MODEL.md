# 数据库架构摘要

## 总体关系

```text
User
 ├─ Role
 ├─ UserPermissionOverride
 ├─ ResponsibilitySignature
 ├─ SecurityExamAttempt
 ├─ VulnerabilityReport(submitter)
 ├─ ReviewAssignment(auditor)
 ├─ Certificate(issuer/revoker)
 ├─ PointLedgerEntry
 └─ AuditLog(actor)

VulnerabilityReport
 ├─ Asset(optional)
 ├─ VulnerabilityAttachment
 ├─ VulnerabilityEvent
 ├─ ReviewAssignment
 ├─ ReviewComment
 ├─ RetestRecord
 └─ Certificate(unique)

AI
 ├─ AiCallLog
 ├─ AiSkill
 ├─ AiFaqEntry
 └─ AiActionProposal
```

## 关键设计

1. 用户只绑定一个角色，但角色可以有多个权限点。
2. 审核员证书签发能力通过用户权限覆盖控制，不写死。
3. 用户授权等级使用 BASIC/TRUSTED/STAFF，授权来源由数据库配置，不绑定单一学校组织结构。
4. 资产范围使用 PUBLIC/INTERNAL/SPECIAL，并由授权策略表控制访问边界。
5. 用户信息只保留学院，不保留专业，减少注册字段和交付差异。
6. 漏洞提交后不可撤回，所有状态变化写事件表。
7. 一个漏洞最多一个证书。
8. 积分必须走流水表。
9. AI 原始会话不长期保存，只保存脱敏摘要、skill、FAQ 和人工确认记录。
10. 审计日志作为核心安全表，覆盖敏感操作。

## 后续实现顺序

1. 创建 Prisma schema。
2. 初始化 PostgreSQL。
3. 生成初始迁移。
4. 写 seed：角色、权限、演示账号、学校配置。
5. 后端实现认证与 RBAC。
