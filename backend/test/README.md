# Backend Tests

后端测试目录。

## 核心 API 冒烟测试

本测试用于本地开发阶段快速确认核心接口是否可用。它只调用登录和只读接口，不创建或修改业务数据。

默认目标：

```text
http://localhost:3000/api
```

运行：

```powershell
cd backend
npm.cmd run test:core-api
```

如后端不在默认地址，可指定：

```powershell
$env:API_BASE_URL="http://localhost:3000/api"
npm.cmd run test:core-api
```

覆盖范围：

- 健康检查
- 三类演示账号登录：学生、审核员、管理员
- 当前用户与准入状态
- 公告、学习资源、漏洞、证书、积分商城
- 管理端用户管理、审计日志、系统设置证书模板

如果返回的是前端 HTML 而不是 API JSON，说明当前端口运行的不是后端服务，或代理配置没有命中后端。

## 后续建议

- 单元测试
- API 集成测试
- 权限测试
- 文件上传安全测试
