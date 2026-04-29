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

## 2. 用户角色

当前规划角色：

- 访客：浏览首页、平台规则、公开公告、证书查询、学习资源、关于平台。
- 学生用户：登录后提交漏洞、查看我的漏洞、学习中心、工具资源、靶场中心、AI 助手、积分商城、我的证书、排行榜、平台公告。
- 审核员：审核漏洞，使用 AI 初步判断漏洞价值、复现完整性、重复性和建议等级。
- 管理员：管理用户、角色权限、漏洞流程、积分商城、公告、资源、靶场、日志审计、系统配置。

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
backend/      后端服务目录，后续初始化 NestJS
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
- 后端下一步才初始化依赖和 NestJS，不要在根目录直接执行后端 npm 命令。

Windows PowerShell 下运行命令推荐使用：

```powershell
npm.cmd run dev
npm.cmd run build
```

## 4. 本地运行命令

必须进入 `frontend` 目录执行 npm 命令。

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

## 5. 当前演示账号

统一认证登录为前端模拟验证。

测试账号：

```text
统一认证码：2025001
密码：123456+-
```

登录前需要完成滑块验证。

邮箱验证码登录目前也是前端模拟：

```text
演示验证码：123456
```

## 6. 当前已实现页面

### 6.1 访客端

已实现页面：

- 未登录首页
- 平台规则
- 公开公告
- 证书查询
- 学习资源
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

用户端菜单：

- 首页
- 提交漏洞
- 我的漏洞
- 学习中心
- 工具资源
- 靶场中心
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
- 安全规范提示框
- 协议勾选
- 底部提交按钮

安全注意：

- Markdown 预览没有使用 `dangerouslySetInnerHTML`，而是渲染 React 节点，避免前端 XSS。
- PDF 上传只有前端类型和大小校验，后续后端必须重新校验文件类型、大小、内容、病毒扫描和访问权限。
- 当前提交按钮只是前端 UI，还没有接后端接口。

## 8. 已抽取的可复用组件

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

- 登录/注册弹窗滑块验证
- 支持鼠标和触摸拖动
- 未完成滑块不能提交登录/注册

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

- 圆形头像，点击可更换（本地预览，限制 2MB 图片）
- 用户名 + 角色标签
- 基础信息：统一认证码、绑定邮箱、账号角色、账号状态
- 个人积分区块：总积分 + 漏洞提交数
- 责任书签署情况：平台使用责任书、漏洞披露保密协议、网络安全承诺书（带已签署/未签署状态）

右侧设置区：

- 修改邮箱（前端模拟）
- 修改密码（前端模拟）
- 操作审计说明

注意：

- 头像上传目前仅前端本地预览，后端需实现 multipart 上传接口，并校验 MIME 类型和文件大小。
- 积分数据和责任书签署状态目前为静态占位，后续需接后端接口。
- 邮箱变更和密码修改目前为前端模拟，后端必须实现二次验证和操作审计。

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

- 我的漏洞列表页
- 漏洞详情页
- 学习中心
- 工具资源
- 靶场中心
- AI 助手页
- 积分商城
- 我的证书
- 排行榜
- 平台公告详情
- 账号安全
- 外观设置
- 审核端页面
- 管理端页面

后端待做：

- 后端项目初始化
- 数据库设计
- 用户认证
- 角色权限系统
- 邮箱验证码
- 统一认证对接
- 漏洞提交接口
- 文件上传接口
- 漏洞审核流程
- 积分系统
- 证书系统
- 通知系统
- 审计日志
- AI 智能体接口
- Docker 部署

## 13. 推荐后续开发顺序

建议继续按以下顺序：

1. 完善提交漏洞页表单状态和前端校验。
2. 实现“我的漏洞”列表页。
3. 实现漏洞详情页。
4. 设计后端数据库模型。
5. 初始化后端服务。
6. 实现真实登录认证。
7. 实现漏洞提交 API。
8. 实现文件上传和安全校验。
9. 实现审核员端漏洞审核页。
10. 实现 AI 智能解析接口。

## 14. 给下一个 Agent 的注意事项

- 用户明确要求按照 `VibeCoding.md` 的方式开发。
- 每一步要详细说明用户需要做什么。
- 不要一次性推进太多步骤。
- 每完成一步要让用户确认是否成功。
- 修改代码前先说明将修改哪些文件。
- 尽量复用已有组件，不要重复造样式。
- 所有命令必须明确是在本地执行还是云服务器执行。
- 当前项目主要是前端阶段，命令都在本地 `frontend` 目录执行。
- 用户偏好简洁、专业、类似苹果官网的流畅体验，但业务页面要像真实 SRC 平台，不要宣传页。
- 主题色为 `#2A6438`。
- 圆角不要太大，当前主要使用 `rounded-lg`。
- 不要使用过度装饰性的渐变球或复杂营销风格。
