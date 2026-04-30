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
公告管理 API 与前端真实数据接入已完成初版
学习资源与靶场资源 API 已完成初版
用户学习中心与管理员学习管理页已接入真实接口
积分商城 API 与前端真实数据接入已完成初版
用户管理 API 与管理员用户管理页真实数据接入已完成初版
审计日志 API 与管理员审计日志页真实数据接入已完成初版
下一步：完善证书模板在线坐标可视化配置
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
- 已创建并应用学习资源 migration：`20260430093000_learning_resources`
- 已创建并应用积分商城 migration：`20260430103000_points_mall`
- 已创建并应用用户管理 migration：`20260430111000_user_management`
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

## 未完成

- 真实 SMTP 邮件发送
- 用户注册准入
- 证书模板在线坐标可视化配置
- 审计日志中间件
- AI Gateway 与 Hermes Agent
- Docker Compose 本地依赖联调
- Ubuntu 云服务器部署

## 下一步

1. 完善系统设置中的证书模板坐标可视化配置。
2. 实现前端 token 过期提示与自动退出体验优化。
3. 规划并接入 AI Gateway 与 Hermes Agent。
4. 补齐核心业务接口的自动化测试。
5. 准备 Ubuntu Docker 部署联调。
