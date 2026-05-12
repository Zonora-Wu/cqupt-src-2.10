# CQUPT-SRC 项目交接文档

## 1. 项目定位

CQUPT-SRC 是一个面向校园网络安全建设的漏洞响应与安全学习平台。

平台目标不是单纯收集漏洞，而是建立一个连接学生、学院、信息化部门、校园资产责任单位的协同系统，覆盖：

- 漏洞提交
- 漏洞分级审核
- 修复跟进
- 复测归档
- 积分激励
- 漏洞证书
- 学习资源
- 在线靶场
- AI 智能体辅助

项目需要保留多种交付形式，后续可能用于单校部署、多校部署、本地部署、Docker 部署和学校服务器部署。

## 1.1 当前项目快照

截至 2026-05-11，项目已经不是纯前端原型，而是一个可本地联调的全栈应用：

- 前端：React 19 + TypeScript + Vite 6 + Tailwind CSS 4，访客端、学生端、审核员端、管理员端主要页面已落地，业务页面大多接入真实 API。
- 后端：NestJS 11 + Prisma，已实现认证/RBAC、账号中心、准入中心、漏洞流程、附件预览、证书、公告、学习资源、积分商城、用户管理、审计日志、通知与数据看板等模块。
- 数据库：PostgreSQL + Prisma，已有多轮 migration 和 seed 演示数据。
- 文件：PDF 附件、证书模板、电子印章、证书 PDF 走后端受控接口与 MinIO 服务设计；本地联调脚本会启动依赖服务。
- 认证：统一认证码+密码登录、邮箱验证码登录、注册、当前用户校验已接入真实后端。
- 滑块验证：`SlideVerify` 已抽成可复用组件，支持本地模式和服务端一次性 `captchaToken` 模式；邮箱登录和注册发码共用服务端模式。
- Hermes Agent：已部署在独立 Docker 容器中，配置目录为 `/home/cocking/cqupt-src-hermes-linux`；宿主机健康检查为 `curl http://localhost:5000/health`。后端按 OpenAI-compatible API 接入，使用 `OPENAI_BASE_URL=http://localhost:5000/v1`、`OPENAI_MODEL=hermes-agent`；若后端也在 Docker 内运行，`OPENAI_BASE_URL` 应使用 Docker 服务名，例如 `http://hermes-agent:5000/v1`。
- 当前主要未完成：真实 SMTP、责任书/安全答题后台管理、证书模板坐标可视化、AI Gateway 二期、完整 Docker/Ubuntu 部署联调。

接手时优先看：

```text
README.md
PROJECT_HANDOFF.md
docs/DEVELOPMENT_STATUS.md
docs/api/README.md
frontend/src/App.tsx
backend/src/app.module.ts
database/prisma/schema.prisma
backend/src/database/seed.ts
```

## 2. 用户角色

当前规划角色：

- 访客：浏览首页、平台规则、公开公告、证书查询、关于平台；学习资源页只展示登录引导，不暴露真实资源和外部链接。
- 学生用户：登录后提交漏洞、查看我的漏洞、学习中心、AI 助手、积分商城、我的证书、排行榜、平台公告。
- 审核员：审核漏洞、复测归档、管理证书、发布公告，并使用 AI 辅助判断漏洞价值和材料完整性。
- 管理员：管理用户、角色权限、漏洞流程、积分商城、公告、学习资源/靶场、日志审计、系统配置。

## 3. 当前前端技术栈

当前前端位于：

```text
frontend/
```

技术栈：

- React
- TypeScript
- Vite 6
- Tailwind CSS 4
- lucide-react
- motion
- @chenglou/pretext

包管理使用 npm。

## 3.1 正式项目结构

当前已经开始从纯前端原型整理为正式全栈项目结构。

新增顶层目录：

```text
backend/      后端服务目录，已初始化 NestJS
database/     Prisma schema、迁移与 seed 数据目录
deploy/       Docker、Nginx、部署脚本目录
docs/         API、架构、安全、部署文档目录
tests/        跨端端到端测试与测试数据目录
storage/      本地开发上传文件临时目录，仅保留 .gitkeep
tmp/          临时文件目录，仅保留 .gitkeep
```

项目结构说明见：

```text
docs/PROJECT_STRUCTURE.md
```

根目录已新增：

```text
README.md
.gitignore
.env.example
```

注意：

- `storage/` 和 `tmp/` 不提交真实运行数据。
- `.env`、`.env.*` 不提交，后续只维护 `.env.example`。
- 后端已初始化依赖和 NestJS，但仍不要在根目录直接执行 npm 命令；前后端命令分别进入 `frontend/` 或 `backend/`。

## 3.2 数据库模型设计

数据库模型设计已开始，当前产物：

```text
database/DATABASE_DESIGN.md
database/prisma/schema.prisma
docs/architecture/DATABASE_MODEL.md
```

核心设计：

- PostgreSQL + Prisma。
- 用户只允许校内注册，访客不入库。
- 用户只能绑定一个角色。
- 角色：学生、审核员、管理员。
- 权限使用 RBAC + 用户级权限覆盖。
- 审核员证书签发权限由权限点控制，可由管理员开启。
- 授权等级使用 BASIC/TRUSTED/STAFF 三层模型。
- 授权来源使用 `authorization_sources` 数据表配置，方便不同学校独立交付。
- 资产授权范围使用 PUBLIC/INTERNAL/SPECIAL，并通过 `authorization_policies` 控制。
- 用户资料只保留学院，不再保留专业。
- 提交漏洞前需要邮箱验证与责任书签署，后续可开启考试通过要求。
- 漏洞支持草稿，提交后不可撤回。
- 一个漏洞只分配一个审核员。
- 一个漏洞最多一张证书。
- 附件只允许 PDF，保存哈希用于去重和审计。
- AI 原始会话不长期保存，只保存脱敏摘要、skill、FAQ 和人工确认记录。
- 审计日志覆盖登录、退出、漏洞提交、附件查看、审核、证书、公告、权限、系统设置和 AI 调用。

注意：Prisma CLI 已作为后端 devDependency 安装，`schema.prisma` 已通过 `npm.cmd run prisma:validate`。

当前已应用 migration：

```text
20260429080513_init
20260429125156_certificate_templates
20260430093000_learning_resources
20260430103000_points_mall
20260430111000_user_management
20260430143000_captcha
20260501090120_cqupt_text
20260501120000_open_registration
20260502090000_user_avatar
```

## 3.3 后端初始化

后端 NestJS 基础骨架已初始化。

当前后端目录：

```text
backend/
├── package.json
├── package-lock.json
├── scripts/
│   ├── prisma-generate.cjs
│   ├── prisma-migrate-deploy.cjs
│   └── prisma-migrate-dev.cjs
├── tsconfig.json
├── tsconfig.build.json
├── .env.example
├── assets/
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── common/crypto/
    ├── config/env.ts
    ├── database/seed.ts
    └── modules/
        ├── access/
        ├── account/
        ├── announcements/
        ├── attachments/
        ├── audit-logs/
        ├── auth/
        ├── captcha/
        ├── certificates/
        ├── dashboard/
        ├── health/
        ├── learning/
        ├── notifications/
        ├── points-mall/
        ├── prisma/
        ├── rbac/
        ├── school/
        ├── system-settings/
        ├── users/
        └── vulnerabilities/
```

当前后端能力：

- NestJS 应用入口。
- 全局 API 前缀，默认 `/api`。
- CORS 白名单读取 `FRONTEND_ORIGIN`。
- 环境变量基础校验。
- 健康检查接口：`GET /api/health`。
- Prisma schema 使用 `database/prisma/schema.prisma`。
- Prisma 全局服务：`backend/src/modules/prisma/`。
- RBAC 权限服务：`backend/src/modules/rbac/`。
- Auth 登录接口初版：`backend/src/modules/auth/`。
- 初始 seed：`backend/src/database/seed.ts`。

当前认证接口：

```text
POST /api/auth/login/password
POST /api/auth/login/email-code
POST /api/auth/email-code
POST /api/auth/register/email-code
POST /api/auth/register
GET /api/auth/me
POST /api/captcha/slider/challenge
POST /api/captcha/slider/verify
```

当前认证与权限基础：

- `JwtAuthGuard`：校验 access token，并将当前用户挂到 request。
- `PermissionsGuard`：校验当前用户是否拥有接口声明的权限点。
- `RequirePermissions(...)`：业务接口声明权限使用。
- `CurrentUser()`：Controller 中读取当前用户。

当前漏洞接口：

```text
POST /api/vulnerabilities
GET /api/vulnerabilities/my
GET /api/vulnerabilities/review-queue
POST /api/vulnerabilities/:reportId/review
POST /api/vulnerabilities/:reportId/attachments
GET /api/attachments/:attachmentId/preview
```

说明：

- 已接入 `JwtAuthGuard` 和 `PermissionsGuard`。
- 需要 `vulnerability:create` 权限。
- `GET /api/vulnerabilities/my` 需要 `vulnerability:read_own` 权限，只返回当前用户自己的漏洞报告与附件摘要。
- `GET /api/vulnerabilities/review-queue` 与 `POST /api/vulnerabilities/:reportId/review` 需要 `vulnerability:review` 权限。
- 提交前校验邮箱已验证、已签署当前激活责任书、可选安全考试通过。
- 审核员可确认有效、要求补充、驳回报告；操作会写入审核意见、流程事件和审计日志。
- 确认有效时可写入最终等级和积分流水。
- 漏洞主体提交后可以上传 PDF 附件，附件保存到 MinIO。
- PDF 后端校验扩展名、MIME、magic bytes、10MB 大小限制，并记录 SHA-256。
- PDF 预览只允许提交本人、审核员、管理员访问，并写入 `VIEW_SENSITIVE_ATTACHMENT` 审计日志。

当前系统设置接口：

```text
GET /api/system-settings/certificate-template/active
POST /api/system-settings/certificate-template/background
POST /api/system-settings/certificate-template/seal
```

说明：

- 以上接口需要 `system:manage` 权限。
- 管理员可在系统设置上传证书背景模板和电子印章。
- 背景模板支持 PDF / PNG，最大 20MB。
- 电子印章支持 PNG，最大 5MB。
- 上传文件保存到 MinIO，数据库保存模板版本、哈希、大小、布局 JSON 和启用状态。
- 上传操作会写入 `CHANGE_SYSTEM_SETTING` 审计日志。

当前证书接口：

```text
GET /api/certificates/manage
GET /api/certificates/my
POST /api/certificates
POST /api/certificates/:certificateId/revoke
GET /api/certificates/:certificateId/preview
GET /api/certificates/public/:certificateNo
```

说明：

- 证书管理队列来自已确认并拥有最终等级的漏洞。
- 签发证书需要 `certificate:issue` 权限；管理员默认拥有，审核员可通过用户级权限覆盖开启。
- 一个漏洞最多一张证书。
- 签发前必须存在当前启用证书模板。
- 签发前必须存在当前启用证书模板和电子印章。
- 签发后会生成证书编号、核验码和真实 PDF 文件，PDF 保存到 MinIO。
- 证书 PDF 已支持读取当前启用 PDF/PNG 背景模板，按 `layoutJson` 叠加文字，并嵌入 PNG 电子印章。
- 证书 PDF 生成依赖 `pdf-lib` 与 `@pdf-lib/fontkit`，中文字体优先读取 `CERTIFICATE_FONT_PATH`，本地 Windows 默认尝试 `C:\Windows\Fonts\simhei.ttf`。
- 证书预览必须走后端鉴权接口，不暴露 MinIO 对象 key。
- 未登录证书查询调用公开核验接口，只返回脱敏信息。

当前公告接口：

```text
GET /api/announcements/public
GET /api/announcements/public/:id
GET /api/announcements/visible
GET /api/announcements/visible/:id
GET /api/announcements/manage
GET /api/announcements/manage/:id
POST /api/announcements
PATCH /api/announcements/:id
POST /api/announcements/:id/publish
POST /api/announcements/:id/offline
```

说明：

- 公开公告只返回已发布且范围为全体用户的公告。
- 登录用户公告会按角色隔离可见范围：学生、审核员、管理员分别只能看到面向自己的公告和全体公告。
- 管理员和审核员通过 `announcement:manage` 权限管理公告。
- 新建公告默认保存为草稿。
- 发布、下线、修改都会写入 `AuditLog`，统一使用 `PUBLISH_ANNOUNCEMENT`，在 metadata.action 中区分 `create_draft`、`update`、`publish`、`offline`。
- 前端管理员公告管理页、审核员公告管理页、访客公开公告页、登录用户平台公告页已接入真实接口。

当前学习资源接口：

```text
GET /api/learning
POST /api/learning/:id/click
GET /api/learning/manage
POST /api/learning
PATCH /api/learning/:id
POST /api/learning/:id/enable
POST /api/learning/:id/disable
DELETE /api/learning/:id
```

说明：

- 学习资源与靶场资源已合并为学习管理。
- 访客不能查看真实资源，也不能拿到外部链接。
- 登录用户可在学习中心查看已上架资源，点击访问会统计次数。
- 当前资源只使用外部链接，不涉及文件上传或 MinIO。
- 管理端只有管理员拥有 `learning:manage`，审核员不管理学习资源。
- 管理员学习管理页已接入真实接口，支持新增、编辑、上架、下架和删除。
- 管理操作写入 `AuditLog`，动作为 `MANAGE_LEARNING_RESOURCE`。

当前积分商城接口：

```text
GET /api/points/summary
GET /api/points/ledger
GET /api/mall/products
POST /api/mall/redemptions
GET /api/mall/redemptions/my
GET /api/mall/manage/products
POST /api/mall/manage/products
PATCH /api/mall/manage/products/:id
POST /api/mall/manage/products/:id/activate
POST /api/mall/manage/products/:id/deactivate
DELETE /api/mall/manage/products/:id
GET /api/mall/manage/redemptions
POST /api/mall/manage/redemptions/:id/complete
POST /api/mall/manage/redemptions/:id/cancel
```

说明：

- 积分以 `PointLedgerEntry` 流水为准，不只依赖用户表缓存字段。
- 漏洞审核奖励写入积分收入流水。
- 商城兑换写入积分支出流水，取消兑换写入积分返还流水。
- 商品状态为 `DRAFT / ACTIVE / INACTIVE`。
- 兑换状态为 `PENDING_PICKUP / COMPLETED / CANCELED / EXPIRED`。
- 商品兑换采用蓝山工作室线下领取，不提供邮寄。
- 用户兑换申请使用数据库事务处理积分扣减、库存扣减、兑换订单和兑换事件。
- 管理员取消兑换使用数据库事务返还积分、恢复库存，并写入兑换事件。
- 商品管理、确认领取、取消兑换写入 `AuditLog`，动作为 `MANAGE_MALL`。

后端本地命令：

```bash
cd backend
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate:dev
npm run db:seed
npm run typecheck
npm run build
npm run dev
```

已验证：

- `npm run prisma:generate` 通过。
- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm run prisma:validate` 通过。
- `npm run test:core-api` 可用于核心 API 冒烟测试，需要本地服务和依赖先启动。

Windows PowerShell 下运行命令推荐使用：

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run db:seed
```

## 4. 本地运行命令

前端命令必须进入 `frontend` 目录执行。

本地开发：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\frontend
npm.cmd run dev
```

本地构建：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\frontend
npm.cmd run build
```

注意：项目根目录目前没有 `package.json`，在根目录执行 `npm.cmd run build` 会报：

```text
ENOENT Could not read package.json
```

后端开发：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run dev
```

后端健康检查：

```text
http://localhost:3000/api/health
```

## 5. 当前演示账号

所有登录均已接入后端真实接口，注册、滑块验证、邮箱验证码均已完成。

学生账号：

```text
统一认证码：2025001
邮箱：student@example.edu.cn
密码：123456+-
```

审核员账号：

```text
统一认证码：0000001
邮箱：auditor@example.edu.cn
密码：auditor123456+-
```

管理员账号：

```text
统一认证码：0000000
邮箱：admin@example.edu.cn
密码：admin123456+-
```

统一认证码登录需要完成本地滑块验证；邮箱验证码登录和注册发码需要完成服务端滑块验证并消耗一次性 `captchaToken`。

开发环境邮箱验证码（登录/注册/修改邮箱/修改密码）固定为：

```text
123456
```

## 6. 当前已实现页面

### 6.1 访客端

已实现页面：

- 未登录首页
- 平台规则
- 公开公告
- 证书查询
- 学习资源（登录引导，不展示真实资源）
- 关于平台
- 登录弹窗
- 注册弹窗

访客端菜单：

- 首页
- 平台规则
- 公开公告
- 证书查询
- 学习资源
- 关于平台

访客端特性：

- 固定顶部导航栏
- 白天/黑夜模式切换
- CQUPT Logo 明暗模式切换
- 首页中英文介绍区
- 介绍区使用字符避让动效
- 登录/注册弹窗明暗主题 Logo
- 浏览器 favicon 已设置为 CQUPT Logo

### 6.2 用户端

已实现页面：

- 用户首页
- 提交漏洞页
- 个人中心
- 我的漏洞
- 学习中心
- AI 助手
- 积分商城
- 我的证书
- 排行榜
- 平台公告
- 通知中心
- 账号安全
- 外观/系统设置

用户端菜单：

- 首页
- 提交漏洞
- 我的漏洞
- 学习中心
- AI 助手
- 积分商城
- 我的证书
- 排行榜
- 平台公告

用户端顶部栏：

- 固定顶部导航
- 左侧 Logo
- 中间横向菜单
- 菜单隐藏横向滚动条
- 鼠标停留到菜单区域时可用滚轮横向滚动
- 右侧通知图标
- 右侧主题切换图标
- 右侧圆形头像
- 鼠标悬停头像显示下拉菜单

头像下拉菜单：

- 个人中心
- 账号安全
- 外观设置
- 退出登录

## 7. 提交漏洞页当前能力

文件：

```text
frontend/src/pages/user/UserSubmitVulnerability.tsx
```

页面结构：

- 顶部标题：提交漏洞
- 说明文案：请在学校授权范围内提交真实、可复现、未公开传播的安全漏洞。
- AI 智能解析横幅
- 基础信息表单
  - 漏洞标题
  - 影响资产
  - 资产责任单位
  - 自评等级
  - 漏洞类型
  - 漏洞 URL
- 复现信息区域
  - 触发请求包 textarea
  - placeholder 包含 HTTP 请求包示例
- 漏洞详情区域
  - Markdown 工具栏
  - 左侧编辑区
  - 行号
  - 右侧实时预览
  - 默认模板
- 附件上传区域
  - 仅支持 PDF
  - 单个文件不超过 10MB
  - 已接入后端 MinIO 上传接口
  - 上传成功后可通过后端受控接口预览 PDF
- 安全规范提示框
- 协议勾选
- 底部提交按钮

安全注意：

- Markdown 预览没有使用 `dangerouslySetInnerHTML`，而是渲染 React 节点，避免前端 XSS。
- PDF 上传前端有基础类型和大小校验，后端会重新校验文件扩展名、MIME、PDF magic bytes 和访问权限。
- 当前还没有接入病毒扫描，后续生产环境建议加入 ClamAV 或异步扫描队列。
- 当前提交按钮已接入真实后端接口。

## 8. 已抽取的可复用组件

当前前端复用组件集中在：

```text
frontend/src/components/layout/
frontend/src/components/navigation/
frontend/src/components/ui/
frontend/src/utils/
```

### 8.1 页面背景

```text
frontend/src/components/layout/AppBackground.tsx
```

作用：

- 统一浅色/深色页面背景
- 统一绿色光晕
- 统一网格背景

使用场景：

- 访客端页面
- 用户端页面
- 审核端页面
- 管理端页面

### 8.2 Logo

```text
frontend/src/components/layout/BrandLogo.tsx
```

作用：

- 自动根据 dark class 切换 Logo
- 白天：`CQUPT_03_logo.png`
- 黑夜：`CQUPT_03_logo_dark.png`

### 8.3 横向菜单

```text
frontend/src/components/navigation/ScrollableNav.tsx
```

作用：

- 横向菜单
- 隐藏滚动条
- 鼠标在菜单区域时，滚轮转为横向滚动
- 支持 desktop 和 mobile 两种模式

### 8.4 用户头像菜单

```text
frontend/src/components/navigation/UserAvatarMenu.tsx
```

作用：

- 圆形头像
- 悬停显示下拉菜单
- 离开范围后延迟关闭
- 下拉菜单包含：
  - 个人中心
  - 账号安全
  - 外观设置
  - 退出登录

### 8.5 卡片容器

```text
frontend/src/components/ui/SurfacePanel.tsx
```

作用：

- 统一卡片圆角
- 统一边框
- 统一半透明背景
- 统一暗色模式
- 统一毛玻璃效果

### 8.6 自定义下拉框

```text
frontend/src/components/ui/SelectInput.tsx
```

作用：

- 替代原生 select
- 样式与头像下拉框一致
- 支持浅色/深色模式
- 支持选中项高亮

提交漏洞页中的“自评等级”和“漏洞类型”已经使用该组件。

### 8.7 滑块验证

```text
frontend/src/components/ui/SlideVerify.tsx
```

作用：

- 可复用滑块验证组件
- 支持鼠标和触摸拖动
- 支持 `local` 本地模式和 `server` 服务端挑战模式
- 服务端模式会通过 `/api/captcha/slider/challenge` 和 `/api/captcha/slider/verify` 换取一次性 `captchaToken`
- 支持 `className`、`disabled`、`labels`、`completeThreshold`、`resetKey`、`onChange`、`onVerify`、`onTokenChange`、`onError`
- 登录弹窗、注册弹窗已使用该组件

示例：

```tsx
<SlideVerify
  mode="server"
  purpose="LOGIN_EMAIL_CODE"
  resetKey={captchaResetKey}
  onTokenChange={setCaptchaToken}
/>
```

注意：

- 不再建议通过 React `key` 强制重建滑块，优先使用 `resetKey`。
- 邮箱登录/注册发码成功后要清空旧 token 并递增 `resetKey`，因为后端 token 一次性消费。
- 后端轨迹校验已放宽，只保留基础耗时、距离、目标位置和异常回退判断，避免正常用户频繁遇到“滑动过快/轨迹异常”。

### 8.8 首页文字交互

```text
frontend/src/components/ui/InteractivePretextParagraph.tsx
```

作用：

- 访客首页介绍区文字避让效果
- 鼠标靠近文字时字符轻微避让
- 已加入短延迟

注意：

- 该组件有较复杂的字符定位和动效逻辑。
- 如果后续性能有问题，可以考虑关闭英文字符级效果，或改成词级动效。

## 8.9 个人中心页

```text
frontend/src/pages/user/UserProfile.tsx
```

页面结构：

左侧用户信息卡片（`lg:grid-cols-[360px_minmax(0,1fr)]`）：

- 圆形头像，点击可更换，已接入 `POST /api/account/avatar`，限制 2MB 图片并同步导航栏头像
- 用户名 + 角色标签
- 基础信息：统一认证码、绑定邮箱、账号角色、账号状态
- 个人积分区块：总积分、漏洞提交数、证书统计等真实接口数据
- 责任书签署情况：展示当前准入与责任书状态

右侧设置区：

- 修改邮箱：两步流程，先验证当前邮箱验证码，再提交新邮箱
- 修改密码：通过当前邮箱验证码验证，无需旧密码，修改后其他设备 refresh token 失效
- 操作审计说明与反馈提示

注意：

- 账号安全页 `UserAccountSecurity.tsx` 已接入 `GET /api/account/audit-logs`，展示登录记录与操作日志。
- 头像当前以 base64 存入 `User.avatarUrl`，适合演示；生产环境可考虑迁移到对象存储。

---

## 8.10 共享组件库（重构成果）

> 本次重构将高度重复的 UI 模式提取为独立组件，减少各页面内联代码。

### 8.10.1 布局组件

| 组件 | 路径 | 说明 |
|------|------|------|
| `PageSection` | `components/layout/PageSection.tsx` | `<section>` 外层容器，`size` prop 控制最大宽度（sm=1080px / md=1180px / lg=1360px，默认 lg） |

### 8.10.2 UI 组件

| 组件 | 路径 | 说明 |
|------|------|------|
| `PageHeader` | `components/ui/PageHeader.tsx` | eyebrow（英文标签+icon）+ h1 + 描述文字，`align` prop 支持居中 |
| `SearchInput` | `components/ui/SearchInput.tsx` | 搜索框，含 Search 图标，`label` / `placeholder` / `value` / `onChange` |
| `SeverityBadge` | `components/ui/SeverityBadge.tsx` | 漏洞等级徽章（严重/高危/中危/低危），使用 `SEVERITY_STYLES` |
| `StatusBadge` | `components/ui/StatusBadge.tsx` | 漏洞状态徽章（7 种状态），使用 `STATUS_STYLES` |
| `EmptyState` | `components/ui/EmptyState.tsx` | 空结果提示卡片，`icon` + `title` + `description` |
| `SectionTitle` | `components/ui/SectionTitle.tsx` | 设置页面章节标题（icon + 标题 + 副标题），从 UserSystemSettings 提取 |

### 8.10.3 工具常量

| 文件 | 路径 | 说明 |
|------|------|------|
| `SEVERITY_STYLES` | `utils/severity.ts` | 漏洞等级 → Tailwind 样式映射，导出 `SeverityLevel` 类型 |
| `STATUS_STYLES` | `utils/vulnStatus.ts` | 漏洞状态 → Tailwind 样式映射，导出 `VulnStatus` 类型 |

### 8.10.4 已应用的页面

以下页面已完成重构，替换了内联的重复模式：

- `UserMyVulnerabilities.tsx` — PageSection / PageHeader / SearchInput / SeverityBadge / StatusBadge / EmptyState
- `UserCertificates.tsx` — PageSection / PageHeader / SearchInput / SeverityBadge / EmptyState
- `UserAnnouncements.tsx` — PageSection / PageHeader / SearchInput / EmptyState
- `UserLearningCenter.tsx` — SearchInput / EmptyState
- `UserPointsMall.tsx` — PageSection / PageHeader / SearchInput / EmptyState
- `UserLeaderboard.tsx` — PageSection / PageHeader
- `UserProfile.tsx` — PageSection / PageHeader
- `UserSystemSettings.tsx` — PageSection / PageHeader / SectionTitle（从本地 function 改为导入）

---

## 9. Logo 资源约定

当前使用的 Logo：

访客/用户顶部栏：

```text
public/assets/logos/CQUPT_03_logo.png
public/assets/logos/CQUPT_03_logo_dark.png
```

登录/注册弹窗：

```text
public/assets/logos/CQUPT_02_logo.png
public/assets/logos/CQUPT_02_logo_dark.png
```

favicon：

```text
public/assets/logos/CQUPT_01_logo_1024px.png
```

## 10. AI 智能体规划

平台计划接入 AI 智能体，不只是普通聊天机器人。

当前 Agent 约定：

```text
部署方式：独立 Docker 容器
配置目录：/home/cocking/cqupt-src-hermes-linux
宿主机地址：http://localhost:5000
健康检查：curl http://localhost:5000/health
后端本机运行：OPENAI_BASE_URL=http://localhost:5000/v1
后端容器运行：OPENAI_BASE_URL=http://hermes-agent:5000/v1
API Key：OPENAI_API_KEY=API_SERVER_KEY
模型：OPENAI_MODEL=hermes-agent
```

注意：前端不能直接请求 Hermes Agent，必须通过后端 AI Gateway 做鉴权、脱敏、限流和审计。

学生侧建议能力：

- 漏洞报告自动整理
- 上传报告后提取标题、资产、类型、复现步骤、修复建议
- 提交前报告质量检查
- 敏感信息提醒
- 学习路径推荐
- 靶场智能匹配
- 工具资源检索
- 漏洞报告写作教练

审核员侧建议能力：

- 漏洞价值初评
- 漏洞等级建议
- 重复漏洞检测
- 审核意见辅助生成
- 修复建议生成
- 高价值证书推荐

管理员侧建议能力：

- 数据驾驶舱智能解读
- 漏洞响应周报/月报生成
- 资产风险画像
- 学生能力画像
- 人才发现

安全边界：

- AI 输出只做辅助，不替代人工审核。
- 不允许 AI 引导未授权测试。
- 不应上传密码、Cookie、Token、隐私数据等敏感内容给第三方模型。
- AI 调用需要审计日志。
- 所有 AI 生成内容提交前必须人工确认。

## 11. 安全要求

平台整体安全要求：

- 用户注册后必须完成安全答题并签署责任书，才能提交漏洞。
- 漏洞报告中可能包含敏感数据，必须有审计日志。
- 文件上传必须限制类型、大小、存储路径和访问权限。
- 后端必须重新校验所有前端字段。
- 漏洞提交权限不能只靠前端判断。
- 审核结论不能由 AI 自动决定。
- 日志中不能记录密码、Token、Cookie、验证码、完整敏感数据。
- Markdown 渲染不得直接插入未净化 HTML。
- 所有接口需要鉴权和权限控制。

## 12. 当前还没有完成的核心功能

前端待做：

- 继续减少残余静态/演示数据，尤其 AI 助手、排行榜、部分通知体验。
- 补齐复杂表单的 loading / error / empty / permission denied 状态。
- 根据真实权限隐藏或禁用操作按钮。
- 修复当前 TypeScript 全量构建中的未使用变量：`AuditorHome.tsx`、`UserAccountSecurity.tsx`、`UserSystemSettings.tsx`。

后端待做：

- 真实 SMTP 邮件发送
- 统一认证真实对接
- 责任书版本管理与安全答题题库后台
- 证书模板在线坐标配置
- 通知系统二期
- AI Gateway 二期：补齐限流、提示词模板、更多场景接口
- Docker Compose 完整联调与 Ubuntu 部署
- 滑块验证二期：图片拼图、Redis 临时存储、风控策略配置

## 13. 推荐后续开发顺序

建议继续按以下顺序：

1. 先清理前端 TypeScript 未使用变量，让 `npm run build` 全量恢复绿色。
2. 接入真实 SMTP，并统一注册、登录、修改邮箱、修改密码的发信配置和限流策略。
3. 完善系统设置：责任书版本管理、安全答题题库、证书模板坐标可视化。
4. 配置 OPENAI_API_KEY 并联调 Hermes OpenAI-compatible API，完善 AI Gateway 二期能力。
5. Docker Compose 完整应用联调，再推进 Ubuntu 云服务器部署。

## 14. 给下一个 Agent 的注意事项

- 用户明确要求按照 `VibeCoding.md` 的方式开发。
- 每一步要详细说明用户需要做什么。
- 不要一次性推进太多步骤。
- 每完成一步要让用户确认是否成功。
- 修改代码前先说明将修改哪些文件。
- 尽量复用已有组件，不要重复造样式。
- 所有命令必须明确是在本地执行还是云服务器执行。
- 当前项目已进入全栈阶段，前端命令在 `frontend/`，后端命令在 `backend/`。
- 用户偏好简洁、专业、类似苹果官网的流畅体验，但业务页面要像真实 SRC 平台，不要宣传页。
- 主题色为 `#2A6438`。
- 圆角不要太大，当前主要使用 `rounded-lg`。
- 不要使用过度装饰性的渐变球或复杂营销风格。
