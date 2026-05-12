# 开发状态

## 当前阶段

```text
已完成：认证/RBAC、漏洞全流程、PDF 附件上传、证书、公告、学习资源、积分商城、用户管理、审计日志、账号中心
已完成：个人中心头像上传（POST /account/avatar，base64 存储）
已完成：头像上传后导航栏头像同步
已完成：用户系统设置页面样式统一（参照管理员端）
已完成：账号安全页（登录记录 + 操作日志，GET /account/audit-logs）
已完成：修改邮箱改为先验证当前邮箱（POST /account/email/identity-code），再填新邮箱
已完成：修改密码改为邮箱验证码方式，无需旧密码，修改后其他设备 refresh token 失效
已完成：数据库迁移 20260502090000_user_avatar（User 表添加 avatarUrl 字段）
已完成：滑块验证体验统一，服务端滑块改为向右滑动完成，并抽象为可复用 SlideVerify 组件
已配置：Hermes Agent 独立 Docker 容器，配置目录 `/home/cocking/cqupt-src-hermes-linux`，宿主机地址 `http://localhost:5000`
已完成：后端 AI Gateway 初版（GET /api/ai/health、POST /api/ai/chat），用户 AI 助手页已接入后端代理
进行中：系统设置完善（责任书版本管理、安全答题题库、证书模板坐标可视化）
下一步：配置 OPENAI_API_KEY 并联调 Hermes OpenAI-compatible API / Ubuntu 部署
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
- 注册已接入真实后端接口，支持校内邮箱验证码、学生账号创建和注册后自动登录
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
- 用户我的证书页已接入 `/api/certificates/my`，支持完整 PDF iframe 预览和受控 blob 下载
- 未登录证书查询已接入公开核验接口，仅展示脱敏信息
- 管理员/审核员公告管理页已接入真实后端接口
- 访客公开公告页已接入真实后端接口
- 登录用户平台公告页已接入真实后端接口
- 用户学习中心已接入真实学习资源接口，登录后可查看资源并统计访问次数
- 管理员学习管理页已接入真实接口，支持新增、编辑、上架、下架、删除外部资源链接
- 访客学习资源页已改为登录引导，不展示真实资源或外部链接
- 用户积分商城已接入真实积分、商品和兑换记录接口
- 管理员积分商城已接入真实商品管理和线下领取处理接口
- 管理员用户管理页已接入真实用户列表、用户详情、角色调整、状态调整和密码重置接口
- 管理员审计日志页已接入真实审计日志接口，支持筛选、分页、统计和详情查看
- 用户系统设置已落地为当前设备本地偏好，支持主题、跟随系统、语言偏好、通知开关、减少动效、紧凑显示和恢复默认
- 注册滑块验证已接入后端真实挑战与一次性 `captchaToken`
- 邮箱登录发码已改为需要 `LOGIN_EMAIL_CODE` 服务端滑块票据
- 邮箱登录和注册发码滑块体验已统一为“向右滑动完成验证”
- `SlideVerify` 已抽象为可复用组件，支持 `local/server` 模式、`resetKey`、自定义文案、禁用状态和完成回调
- 邮箱登录验证码已限制用途为 `LOGIN`，且新验证码会使旧验证码失效
- 邮箱登录验证码已增加 60 秒重发间隔和 10 分钟发送次数限制
- 前端入口已将用户、审核员、管理员工作台改为 lazy chunk
- 用户端、管理员端二级业务页面已改为菜单级懒加载，生产构建主入口 chunk 从约 743KB 降至约 400KB
- 新增统一前端 API client，集中处理 JSON、FormData、PDF blob 请求、后端错误解析和 401 会话失效
- App 已监听会话失效事件，token 过期或后端返回 401 时会清理本地登录态、回到未登录首页并显示提示
- 登录/注册弹窗移除整屏强 backdrop blur 和 scale 缩放动画，改为轻量淡入位移，减少弹窗打开时的页面抖动
- 个人中心已接入 `/api/account/profile` 展示真实账号信息、责任书、积分和证书统计
- 个人中心已接入 `/api/account/password/change`、`/api/account/email/code` 和 `/api/account/email/change`
- 提交漏洞页已接入 `/api/access/status`，可在提交前展示缺失准入条件
- 提交漏洞页已接入当前责任书签署与安全答题记录接口
- 新增前端通用告警组件 `AlertMessage`，个人中心和提交漏洞页已用于接口错误、表单校验、成功反馈和准入提醒- 用户系统设置页面样式已统一，参照管理员端 AdminSystemSettings 风格（bg-brand-600 活跃侧边栏、SettingsCard + SettingRow 布局、较大切换按钮）
- 新增账号安全页 `UserAccountSecurity`，支持安全概览、登录记录（AUTH 类型审计日志）和操作日志（全模块、结果筛选、分页）
- 个人中心已接入真实头像上传（`POST /api/account/avatar`），上传后同步更新页面和导航栏头像
- 个人中心修改邮箱弹窗改为两步流程：先向当前邮箱发送验证码，验证通过后填写新邮箱
- 个人中心修改密码改为邮箱验证码方式，弹窗内先发送验证码再填写新密码，无需旧密码
- 导航栏头像（`UserAvatarMenu`）已支持展示用户上传的头像图片，有图片时替换默认姓名首字
- 新增后端 AI Gateway 模块 `backend/src/modules/ai`，提供 Agent 健康检查代理和 Chat 代理
- 用户 AI 助手页已从前端演示回复改为调用 `/api/ai/chat`
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
- 已创建并应用学习资源 migration：`20260430093000_learning_resources`
- 已创建并应用积分商城 migration：`20260430103000_points_mall`
- 已创建并应用用户管理 migration：`20260430111000_user_management`
- 已创建滑块验证 migration：`20260430143000_captcha`
- 已创建并应用用户头像 migration：`20260502090000_user_avatar`（User 表添加 `avatarUrl TEXT` 字段）
- 已写入 seed：3 个角色、22 个权限、3 个演示用户、9 条授权策略、4 条演示公告、4 条演示学习资源、4 个演示商品、学生演示积分 1260

### 后端

- NestJS 基础服务
- 环境变量校验
- CORS 配置
- `/api/health` 健康检查
- Prisma 全局服务
- 认证模块初版
- 统一认证码 + 密码登录接口
- 邮箱验证码开发接口
- 注册邮箱验证码接口：`POST /api/auth/register/email-code`
- 学生注册接口：`POST /api/auth/register`
- 滑块验证挑战接口：`POST /api/captcha/slider/challenge`
- 滑块验证校验接口：`POST /api/captcha/slider/verify`
- 注册邮箱验证码接口需要携带后端签发的一次性 `captchaToken`
- 滑块轨迹校验已放宽，保留基础耗时、距离、目标位置和异常回退判断，降低正常用户误判
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
- 公开公告列表接口：`GET /api/announcements/public`
- 公开公告详情接口：`GET /api/announcements/public/:id`
- 登录用户可见公告列表接口：`GET /api/announcements/visible`
- 登录用户可见公告详情接口：`GET /api/announcements/visible/:id`
- 公告管理列表接口：`GET /api/announcements/manage`
- 公告管理详情接口：`GET /api/announcements/manage/:id`
- 新建公告草稿接口：`POST /api/announcements`
- 修改公告接口：`PATCH /api/announcements/:id`
- 发布公告接口：`POST /api/announcements/:id/publish`
- 下线公告接口：`POST /api/announcements/:id/offline`
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
- 公告创建、修改、发布、下线会写入 `AuditLog`，动作为 `PUBLISH_ANNOUNCEMENT`，metadata 中区分具体动作
- 学习资源列表接口：`GET /api/learning`
- 学习资源访问统计接口：`POST /api/learning/:id/click`
- 学习资源管理列表接口：`GET /api/learning/manage`
- 学习资源创建接口：`POST /api/learning`
- 学习资源修改接口：`PATCH /api/learning/:id`
- 学习资源上架接口：`POST /api/learning/:id/enable`
- 学习资源下架接口：`POST /api/learning/:id/disable`
- 学习资源删除接口：`DELETE /api/learning/:id`
- 学习资源仅登录用户可见，访客不可查看真实资源；管理权限仅管理员拥有
- 学习资源创建、修改、上架、下架、删除会写入 `AuditLog`，动作为 `MANAGE_LEARNING_RESOURCE`
- 积分概览接口：`GET /api/points/summary`
- 积分流水接口：`GET /api/points/ledger`
- 用户商品列表接口：`GET /api/mall/products`
- 用户兑换申请接口：`POST /api/mall/redemptions`
- 用户兑换记录接口：`GET /api/mall/redemptions/my`
- 管理员商品列表接口：`GET /api/mall/manage/products`
- 管理员商品创建接口：`POST /api/mall/manage/products`
- 管理员商品修改接口：`PATCH /api/mall/manage/products/:id`
- 管理员商品上架接口：`POST /api/mall/manage/products/:id/activate`
- 管理员商品下架接口：`POST /api/mall/manage/products/:id/deactivate`
- 管理员商品删除接口：`DELETE /api/mall/manage/products/:id`
- 管理员兑换处理列表接口：`GET /api/mall/manage/redemptions`
- 管理员确认领取接口：`POST /api/mall/manage/redemptions/:id/complete`
- 管理员取消兑换接口：`POST /api/mall/manage/redemptions/:id/cancel`
- 兑换申请使用数据库事务处理积分扣减、库存扣减、兑换订单和兑换事件
- 取消兑换使用数据库事务返还积分、恢复库存并写入兑换事件
- 商品管理、确认领取、取消兑换会写入 `AuditLog`，动作为 `MANAGE_MALL`
- 用户管理列表接口：`GET /api/users/manage`
- 用户管理选项接口：`GET /api/users/manage/options`
- 用户管理详情接口：`GET /api/users/manage/:id`
- 用户角色调整接口：`PATCH /api/users/manage/:id/role`
- 用户状态调整接口：`PATCH /api/users/manage/:id/status`
- 用户级权限覆盖接口：`PATCH /api/users/manage/:id/permissions`
- 用户密码重置接口：`POST /api/users/manage/:id/reset-password`
- 用户管理接口统一需要 `user:manage` 权限
- 用户角色调整写入 `AuditLog`，动作为 `CHANGE_USER_PERMISSION`
- 用户状态调整和密码重置写入 `AuditLog`，动作为 `MANAGE_USER`
- 审计日志列表接口：`GET /api/audit-logs`
- 审计日志统计接口：`GET /api/audit-logs/stats`
- 审计日志详情接口：`GET /api/audit-logs/:id`
- 目标对象审计日志接口：`GET /api/audit-logs/target/:targetType/:targetId`
- 审计日志接口统一需要 `audit:read` 权限
- 审计日志 API 会返回动作中文名、业务模块、风险等级、执行结果、摘要和脱敏后的 metadata
- 角色、权限、授权策略、演示账号 seed 脚本
- 登录接口已通过本地数据库验证
- 管理员密码登录、学生邮箱验证码登录已通过真实接口验证
- `/api/auth/me` 已通过 Bearer token 验证
- `POST /api/vulnerabilities` 已通过真实登录 token 验证并写入数据库
- TypeScript 类型检查通过
- 后端构建通过
- 校内邮箱策略已抽取为 `SchoolPolicyService`，注册和账号换邮箱共用同一套域名规则
- 账号中心接口：`GET /api/account/profile`
- 当前用户修改密码接口：`POST /api/account/password/change`
- 当前用户修改邮箱验证码接口：`POST /api/account/email/code`
- 当前用户修改邮箱接口：`POST /api/account/email/change`
- 准入中心状态接口：`GET /api/access/status`
- 当前责任书接口：`GET /api/access/responsibility-agreement/current`
- 当前责任书签署接口：`POST /api/access/responsibility-agreement/sign`
- 安全答题提交接口：`POST /api/access/security-exam/submit`
- 漏洞提交接口已改为调用 `AccessPolicyService.assertCanSubmitVulnerability`
- 新增核心 API 冒烟测试：`npm.cmd run test:core-api`
- 核心 API 冒烟测试已覆盖健康检查、三类账号登录、用户/审核员/管理员核心只读接口
- 修复 `AccessModule` 与 `AccountModule` 使用 `JwtAuthGuard` 时缺少 `RbacModule` 导入导致后端启动失败的问题
- 头像上传接口：`POST /api/account/avatar`（multipart/form-data，2MB 限制，MIME 校验，base64 存储于 User.avatarUrl）
- 个人用户审计日志接口：`GET /api/account/audit-logs`（JWT 鉴权，仅返回当前用户自身操作记录）
- 发送当前邮箱验证码接口：`POST /api/account/email/identity-code`（purpose: CHANGE_EMAIL | CHANGE_PASSWORD，向已绑定邮箱发送）
- 修改邮箱接口（`POST /api/account/email/change`）改为验证当前邮箱验证码，而非新邮箱验证码
- 修改密码接口（`POST /api/account/password/change`）改为邮箱验证码校验，移除旧密码字段，密码修改后撤销所有 refresh token

## 未完成

- 真实 SMTP 邮件发送
- 责任书后台版本管理与安全答题题库管理
- 证书模板在线坐标可视化配置
- 滑块验证二期图片拼图与 Redis 临时存储
- 审计日志中间件
- AI Gateway 二期：补齐限流、提示词模板、更多场景接口
- Docker Compose 本地依赖联调
- Ubuntu 云服务器部署

## 下一步

1. 完善系统设置中的责任书版本管理、安全答题题库和证书模板坐标可视化配置。
2. 配置 OPENAI_API_KEY 并联调 Hermes OpenAI-compatible API，完善 AI Gateway 二期能力。
3. 准备 Ubuntu Docker 部署联调。
