# CQUPT-SRC 项目目录结构

本文档记录当前仓库的真实目录组织，用于交接、部署排查和后续功能开发定位。

```text
cqupt-src-2.10/
├── README.md                         # 项目总览与启动入口
├── PROJECT_HANDOFF.md                # 项目交接说明
├── VibeCoding.md                     # 开发流程与协作约束
├── .env.example                      # 环境变量示例
├── package.json                      # 根级 Prisma 依赖
├── CQUPT/                            # 学校 / 平台 Logo 原始资源
├── backend/                          # NestJS 后端服务
├── frontend/                         # React + TypeScript + Vite 前端
├── database/                         # 数据库设计、Prisma schema、迁移与种子说明
├── deploy/                           # Docker、Nginx、本地启停与部署脚本
├── docs/                             # 面向开发、部署、接口、AI 的结构化文档
├── tests/                            # API smoke、E2E 与测试夹具目录
├── storage/                          # 本地对象存储 / 上传文件目录，运行数据不应提交
├── tmp/                              # 本地临时文件与日志目录，运行数据不应提交
└── 文档/                             # 原始需求、设计材料与中文补充说明
```

## 前端

```text
frontend/
├── public/
│   └── assets/                       # 静态公开资源
├── src/
│   ├── App.tsx                       # 前端应用入口组件
│   ├── main.tsx                      # React 挂载入口
│   ├── index.css                     # 全局样式
│   ├── assets/                       # 前端内置图片资源
│   ├── components/
│   │   ├── auth/                     # 登录、注册、认证相关弹窗
│   │   ├── layout/                   # 页面布局与区块容器
│   │   ├── navigation/               # 导航栏、用户菜单、通知入口
│   │   ├── theme/                    # 主题相关组件
│   │   └── ui/                       # 通用 UI：提示、搜索、选择器、面板、滑块验证等
│   ├── hooks/                        # 前端自定义 Hook
│   ├── pages/
│   │   ├── admin/                    # 管理员端页面
│   │   ├── auditor/                  # 审核员端页面
│   │   ├── guest/                    # 访客公开页面
│   │   └── user/                     # 学生 / 普通用户端页面
│   ├── routes/                       # 路由预留目录
│   ├── services/                     # API 请求封装
│   ├── stores/                       # 状态管理预留目录
│   ├── types/                        # 前端共享类型预留目录
│   └── utils/                        # 严重等级、漏洞状态等工具函数
├── package.json
└── vite.config.ts
```

前端重点业务文件：

```text
frontend/src/services/ai.ts                 # 用户端 AI 对话、外观、额度接口
frontend/src/services/systemSettings.ts     # 管理员系统设置接口
frontend/src/services/users.ts              # 管理员用户管理接口
frontend/src/pages/user/UserAIAssistant.tsx # 用户端 AI 助手页面
frontend/src/pages/admin/AdminSystemSettings.tsx
frontend/src/pages/admin/AdminUserManagement.tsx
```

## 后端

```text
backend/
├── .env                              # 后端本地环境变量，不应提交真实密钥
├── assets/
│   └── fonts/                        # PDF 证书等后端生成能力使用的字体
├── scripts/                          # Prisma generate / migrate 脚本
├── src/
│   ├── main.ts                       # NestJS 启动入口
│   ├── app.module.ts                 # 根模块
│   ├── common/
│   │   └── crypto/                   # 密码哈希等通用加密能力
│   ├── config/                       # 配置读取与环境变量管理
│   ├── database/                     # 后端种子入口
│   ├── integrations/
│   │   └── object-storage/           # 本地 / MinIO 对象存储抽象
│   ├── jobs/                         # 后台任务预留
│   └── modules/                      # 业务模块
├── test/                             # 后端测试目录
├── package.json
└── tsconfig*.json
```

后端业务模块：

```text
backend/src/modules/
├── access/           # 准入状态、责任书、安全考试
├── account/          # 个人中心、头像、邮箱、密码、个人审计日志
├── ai/               # Hermes Agent 代理、AI 对话、AI 外观、AI token 额度
├── announcements/    # 公告发布、可见公告、公开公告
├── attachments/      # 漏洞附件上传与预览
├── audit-logs/       # 审计日志、脱敏、统计、详情
├── auth/             # 登录、注册、JWT、权限守卫
├── captcha/          # 可复用滑块验证
├── certificates/     # 证书签发、撤销、PDF 生成、公开核验
├── dashboard/        # 用户 / 审核员 / 管理员首页统计
├── health/           # 健康检查
├── learning/         # 学习中心、靶场资源、后台管理
├── notifications/    # 通知中心
├── points-mall/      # 积分商城、商品、兑换、领取
├── prisma/           # PrismaService 注入模块
├── rbac/             # 权限点与 RBAC 服务
├── school/           # 校内策略、责任书 / 考试策略
├── system-settings/  # 系统设置、证书模板、AI 头像、默认 AI 额度
├── users/            # 管理员用户管理、角色、状态、AI 额度
└── vulnerabilities/  # 漏洞提交、审核、复测、状态流转
```

后端模块通常采用以下文件约定：

```text
*.module.ts       # NestJS 模块声明
*.controller.ts   # HTTP 路由
*.service.ts      # 业务逻辑
*.types.ts        # DTO / 领域类型
*.validation.ts   # 请求参数归一化与校验
```

## 数据库

```text
database/
├── DATABASE_DESIGN.md                # 数据库设计说明
├── README.md
├── prisma/
│   ├── schema.prisma                 # Prisma 数据模型
│   ├── README.md
│   └── migrations/                   # 已应用 / 待应用迁移
└── seed/
    └── README.md                     # 种子数据说明
```

当前重要迁移包括：

```text
20260429080513_init
20260429125156_certificate_templates
20260430093000_learning_resources
20260430103000_points_mall
20260430111000_user_management
20260430143000_captcha
20260502090000_user_avatar
20260512090000_ai_user_quota
20260512133000_ai_quota_periods
```

## 部署

```text
deploy/
├── README.md
├── docker/
│   ├── README.md
│   └── docker-compose.local.yml      # 本地 PostgreSQL、Redis、MinIO 等依赖
├── nginx/
│   └── README.md                     # Nginx 反代说明
└── scripts/
    ├── README.md
    ├── start-local.sh
    ├── stop-local.sh
    ├── start-local.ps1
    └── stop-local.ps1
```

Hermes Agent 当前作为独立 Docker 容器运行，平台后端按 OpenAI-compatible API 调用，相关配置在 `backend/.env` 中维护。

## 文档

```text
docs/
├── PROJECT_STRUCTURE.md              # 当前文件
├── DEVELOPMENT_STATUS.md             # 开发进度与已完成能力
├── TECH_STACK.md                     # 技术栈说明
├── AI.md                             # AI 目标效果、当前进度、部署与接口链路
├── api/
│   └── README.md                     # API 文档
├── architecture/
│   ├── README.md
│   └── DATABASE_MODEL.md             # 数据模型说明
├── deployment/
│   └── README.md                     # 部署说明
└── security/
    └── README.md                     # 安全说明
```

原始材料和补充设计位于：

```text
文档/
├── 用户端AI助手.md
├── 总体建议.md
├── 步骤.md
├── 提交GitHub.md
├── 数据库提示词.md
├── cqupt.md
├── 初始提案.txt
└── 校级漏洞响应平台项目需求 / 设计说明书
```

## 测试

```text
tests/
├── README.md
├── api/
│   └── core-api-smoke.mjs            # 核心 API 冒烟测试
├── e2e/
│   └── README.md
└── fixtures/
    └── README.md
```

## 目录约定

1. 前端所有接口调用统一放在 `frontend/src/services/`，页面不直接拼接后端基础 URL。
2. 后端所有业务能力按领域放入 `backend/src/modules/`，避免跨模块随意访问数据库。
3. Prisma schema 和迁移统一维护在 `database/prisma/`，后端通过 `PrismaService` 使用。
4. 上传文件、临时日志、构建产物、依赖目录不应提交到 Git。
5. Hermes Agent 不直接暴露给前端，统一由后端 `ai` 模块代理。
6. 新增接口需同步更新 `docs/api/README.md`，新增 AI 能力需同步更新 `docs/AI.md` 或 `文档/用户端AI助手.md`。

## 常用入口

```text
README.md
PROJECT_HANDOFF.md
docs/DEVELOPMENT_STATUS.md
docs/TECH_STACK.md
docs/AI.md
docs/api/README.md
docs/deployment/README.md
database/DATABASE_DESIGN.md
文档/用户端AI助手.md
```
