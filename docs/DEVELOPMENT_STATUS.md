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
下一步：实现我的漏洞列表 API
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
- 注册和滑块验证仍为前端占位/交互

### 数据库

- PostgreSQL + Prisma 设计
- RBAC + 用户级权限覆盖
- 三层授权模型：`BASIC / TRUSTED / STAFF`
- 资产范围：`PUBLIC / INTERNAL / SPECIAL`
- 漏洞状态流转
- PDF 附件模型
- 证书、积分、公告、学习资源、AI、审计日志模型
- `prisma validate` 已通过
- 已创建并应用初始 migration：`20260429080513_init`
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
- PDF 附件上传接口：`POST /api/vulnerabilities/:reportId/attachments`
- PDF 受控预览接口：`GET /api/attachments/:attachmentId/preview`
- 提交前准入校验：邮箱验证、责任书签署、可选安全考试
- 文件上传安全校验：仅 PDF、10MB 限制、MIME/扩展名/magic bytes 校验、SHA-256 记录
- MinIO 对象存储服务，启动时按需创建 bucket
- PDF 预览访问控制：提交本人、审核员、管理员
- PDF 预览审计日志：`VIEW_SENSITIVE_ATTACHMENT`
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
- 审核员审核 API
- 证书签发 API
- 公告、学习资源、积分商城 API
- 审计日志中间件
- AI Gateway 与 Hermes Agent
- Docker Compose 本地依赖联调
- Ubuntu 云服务器部署

## 下一步

1. 实现我的漏洞列表 API。
2. 将我的漏洞页面从 mock 数据切换到真实接口，并接入 PDF 预览入口。
3. 实现前端 token 过期提示与自动退出体验优化。
4. 实现审核员漏洞审核 API。
5. 接入证书签发 API。
