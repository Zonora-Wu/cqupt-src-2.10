# CQUPT-SRC 项目说明

CQUPT-SRC 是校园漏洞响应与安全学习平台，面向学生、审核员和管理员，覆盖漏洞提交、审核、修复、复测、归档、证书、积分、学习资源、审计日志和 AI 辅助等业务。

项目采用前后端分离架构：

- `frontend/`：React 19、TypeScript、Vite、Tailwind CSS。
- `backend/`：NestJS 11、Prisma。
- `database/`：PostgreSQL 数据模型和迁移。
- `retest-runner/`：AI 漏洞复测的受限 Runner。
- `docs/`：架构、API、实施方案和开发状态文档。
- 平台 Hermes 独立部署在 `/home/cocking/cqupt-src-hermes-linux/`，所有平台 AI 能力由 NestJS 后端统一控制。

当前重点是 AI 漏洞自动复测：低危、标准化验证由 Runner 执行；复杂或高风险验证由 Hermes Direct 在人工审批范围内执行；最终报告必须由审核员或管理员人工确认。

## 目录结构

```text
cqupt-src-2.10/
├── frontend/                 # React 前端，包含学生端、审核员端和管理员端页面
├── backend/
│   ├── src/
│   │   ├── modules/          # 认证、漏洞、AI、复测、积分等业务模块
│   │   ├── common/           # Guard、装饰器、异常处理等公共能力
│   │   ├── config/           # 环境变量和应用配置
│   │   ├── integrations/     # Hermes、MinIO、邮件等外部集成
│   │   └── jobs/             # 后台任务和队列
│   └── test/                 # 后端测试
├── database/
│   ├── prisma/               # Prisma schema 和数据库迁移
│   └── seed/                 # 初始化数据
├── retest-runner/            # 低风险 AI 漏洞自动复测 Runner
├── retest-egress-proxy/      # Hermes Direct 动态目标白名单与隔离出站代理
├── deploy/                   # Docker、Nginx、启动和部署脚本
├── tests/
│   ├── e2e/                  # 端到端测试
│   └── fixtures/             # 测试数据
├── docs/
│   ├── plans/                # 功能实施方案
│   ├── architecture/         # 架构设计
│   ├── api/                  # API 文档
│   ├── security/             # 安全说明
│   └── deployment/           # 部署说明
├── README.md                 # 项目总览和运行方式
├── PROJECT_HANDOFF.md        # 项目交接说明
└── codex.md                  # Codex 项目说明和协作规则
```

## Codex 协作规则

1. 遇到项目实现细节、产品边界或技术方案存在疑问时，必须提前询问用户，确认后再开始实现。
2. 不采用只求跑通的最小实现。实现应覆盖完整业务流程、安全边界、异常处理、审计、测试和可维护性。
3. 每次对话应根据任务选择并使用合适的 Skill；没有匹配的 Skill 时可以不使用,最后加入一句这次使用了哪些skill。
4. 每次修改代码后，必须同步更新相关文档，确保实现、接口、架构说明和开发状态保持一致。
