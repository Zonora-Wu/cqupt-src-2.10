# 开发状态

## 当前阶段

```text
前端原型完成度较高
正式项目结构已整理
数据库模型 v0.1 已完成
后端 NestJS 基础骨架已完成
认证与 RBAC 基础模块已完成初版
本地 PostgreSQL migration 与 seed 已完成
前端登录已切换到真实后端接口
当前用户接口与 RBAC 权限守卫已完成初版
漏洞提交 API 与提交前准入校验已完成初版
文件上传、MinIO 安全校验与 PDF 受控预览已完成初版
我的漏洞列表 API 与前端真实数据接入已完成初版
审核员漏洞审核 API 与前端真实数据接入已完成初版
证书模板模型与管理员系统设置上传接口已完成初版
证书签发、撤销、PDF 预览与公开核验接口已完成初版
证书 PDF 模板叠加文字与电子印章盖章已完成初版
管理员/审核员证书管理页已接入真实接口
未登录证书查询已接入公开核验接口
下一步：接入公告管理 API
```

## 已完成

### 前端

- 访客端页面
- 用户端页面
- 审核员端页面
- 管理员端页面
- 主题切换
- 统一背景、Logo、菜单、卡片、下拉框等复用组件
- 登录已接入真实后端接口
- 刷新页面会调用 `/api/auth/me` 校验登录态
- 提交漏洞页已接入真实后端接口
- 提交漏洞页已接入 PDF 附件上传与上传后预览
- 我的漏洞页已接入真实后端接口
- 我的漏洞页已支持展示 PDF 附件并调用受控预览接口
- 审核员漏洞审核页已接入真实审核队列接口
- 审核员漏洞审核页已支持确认有效、要求补充、驳回三类真实审核操作
- 管理员系统设置已支持上传证书背景模板和电子印章
- 管理员/审核员证书管理页已接入真实后端证书队列
- 证书管理页已支持签发、撤销和后端 PDF 预览
- 未登录证书查询已接入公开核验接口，仅展示脱敏信息
- 注册和滑块验证仍为前端占位/交互

### 数据库

- PostgreSQL + Prisma 设计
- RBAC + 用户级权限覆盖
- 三层授权模型：`BASIC / TRUSTED / STAFF`
- 资产范围：`PUBLIC / INTERNAL / SPECIAL`
- 漏洞状态流转
- PDF 附件模型
- 证书、积分、公告、学习资源、AI、审计日志模型
- 证书模板模型：支持背景模板、电子印章、布局 JSON、启用版本
- `prisma validate` 已通过
- 已创建并应用初始 migration：`20260429080513_init`
- 已创建并应用证书模板 migration：`20260429125156_certificate_templates`
- 已写入 seed：3 个角色、20 个权限、3 个演示用户、9 条授权策略

### 后端

- NestJS 基础服务
- 环境变量校验
- CORS 配置
- `/api/health` 健康检查
- Prisma 全局服务
- 认证模块初版
- 统一认证码 + 密码登录接口
- 邮箱验证码开发接口
- 当前用户接口：`GET /api/auth/me`
- access token 校验守卫：`JwtAuthGuard`
- 权限守卫：`PermissionsGuard`
- 权限声明装饰器：`RequirePermissions(...)`
- RBAC 权限查询服务
- 漏洞提交接口：`POST /api/vulnerabilities`
- 我的漏洞列表接口：`GET /api/vulnerabilities/my`
- 审核员漏洞审核队列接口：`GET /api/vulnerabilities/review-queue`
- 审核员漏洞审核操作接口：`POST /api/vulnerabilities/:reportId/review`
- 当前启用证书模板接口：`GET /api/system-settings/certificate-template/active`
- 证书背景模板上传接口：`POST /api/system-settings/certificate-template/background`
- 电子印章上传接口：`POST /api/system-settings/certificate-template/seal`
- 证书管理列表接口：`GET /api/certificates/manage`
- 我的证书接口：`GET /api/certificates/my`
- 证书签发接口：`POST /api/certificates`
- 证书撤销接口：`POST /api/certificates/:certificateId/revoke`
- 证书 PDF 预览接口：`GET /api/certificates/:certificateId/preview`
- 公开证书核验接口：`GET /api/certificates/public/:certificateNo`
- PDF 附件上传接口：`POST /api/vulnerabilities/:reportId/attachments`
- PDF 受控预览接口：`GET /api/attachments/:attachmentId/preview`
- 提交前准入校验：邮箱验证、责任书签署、可选安全考试
- 文件上传安全校验：仅 PDF、10MB 限制、MIME/扩展名/magic bytes 校验、SHA-256 记录
- MinIO 对象存储服务，启动时按需创建 bucket
- PDF 预览访问控制：提交本人、审核员、管理员
- PDF 预览审计日志：`VIEW_SENSITIVE_ATTACHMENT`
- 审核操作会写入审核意见、流程事件和审计日志
- 确认有效时可写入最终等级和积分流水
- 证书模板上传会写入 MinIO、数据库模板记录和系统设置审计日志
- 签发证书会校验漏洞已确认、最终等级、一个漏洞最多一张证书、当前启用证书模板
- 签发证书会生成真实 PDF 文件并保存到 MinIO，当前 PDF 内容为最小占位版
- 证书签发与撤销会写入 `Certificate`、`VulnerabilityEvent` 和 `AuditLog`
- 证书 PDF 会读取当前启用 PDF/PNG 背景模板，叠加证书编号、核验码、姓名、漏洞标题、报告编号、最终等级、影响资产、日期、贡献说明，并嵌入电子印章
- 证书 PDF 生成使用 `pdf-lib` 与 `@pdf-lib/fontkit`，中文字体可通过 `CERTIFICATE_FONT_PATH` 指定
- 角色、权限、授权策略、演示账号 seed 脚本
- 登录接口已通过本地数据库验证
- 管理员密码登录、学生邮箱验证码登录已通过真实接口验证
- `/api/auth/me` 已通过 Bearer token 验证
- `POST /api/vulnerabilities` 已通过真实登录 token 验证并写入数据库
- TypeScript 类型检查通过
- 后端构建通过

## 未完成

- 真实 SMTP 邮件发送
- 用户注册准入
- 证书模板在线坐标可视化配置
- 公告、学习资源、积分商城 API
- 审计日志中间件
- AI Gateway 与 Hermes Agent
- Docker Compose 本地依赖联调
- Ubuntu 云服务器部署

## 下一步

1. 接入公告管理 API。
2. 接入学习资源与靶场管理 API。
3. 完善系统设置中的证书模板坐标可视化配置。
4. 实现前端 token 过期提示与自动退出体验优化。
5. 继续推进 AI Gateway 与 Hermes Agent 接入设计。
