# CQUPT-SRC Frontend

前端使用 React + TypeScript + Vite + Tailwind CSS 构建。

## 当前能力

已实现主要页面原型：

- 访客端：首页、平台规则、公开公告、证书查询、学习资源、关于平台、登录注册弹窗。
- 用户端：首页、提交漏洞、我的漏洞、学习中心、AI 助手、积分商城、我的证书、排行榜、平台公告、个人中心。
- 审核员端：首页、漏洞审核、复测归档、证书管理、AI 辅助、审核记录、公告管理。
- 管理员端：首页、漏洞管理、证书管理、用户管理、公告管理、学习管理、积分商城、审计日志、系统设置。

## 本地开发

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\frontend
npm.cmd run dev
```

默认地址：

```text
http://localhost:5173
```

## 构建

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\frontend
npm.cmd run build
```

## 演示账号

当前登录与漏洞提交已接入后端真实接口，启动前请先启动 PostgreSQL、MinIO 和后端服务。

```text
学生：2025001 / 123456+-
审核员：0000001 / auditor123456+-
管理员：0000000 / admin123456+-
邮箱验证码：123456
```

开发环境通过 Vite proxy 将 `/api` 转发到 `http://localhost:3000`。

页面刷新后会调用 `/api/auth/me` 校验 access token，token 无效时会清除本地登录态。

## 重要组件

```text
src/components/layout/AppBackground.tsx
src/components/layout/BrandLogo.tsx
src/components/navigation/ScrollableNav.tsx
src/components/navigation/UserAvatarMenu.tsx
src/components/ui/SurfacePanel.tsx
src/components/ui/PageHeader.tsx
src/components/ui/SearchInput.tsx
src/components/ui/SelectInput.tsx
src/components/ui/InteractivePretextParagraph.tsx
src/components/ui/SlideVerify.tsx
```

## 注意事项

- 前端目前除登录外，大量页面仍使用 mock 数据。
- 提交漏洞页已经接入真实后端主体提交接口和 PDF 附件上传接口。
- 我的漏洞页已经接入真实后端列表接口，并可预览已上传 PDF。
- 审核员漏洞审核页已经接入真实审核队列接口，并支持确认有效、要求补充、驳回。
- 管理员系统设置页已经接入证书模板上传接口，支持证书背景模板和电子印章上传。
- PDF 预览通过后端受控接口返回 blob，不直接暴露 MinIO 地址。
- 下一阶段会逐步替换为后端 API。
- 文件上传、权限判断、证书核验、AI 调用都不能只靠前端判断。
- Hermes Agent 不能由前端直接调用，必须走后端 AI Gateway。
