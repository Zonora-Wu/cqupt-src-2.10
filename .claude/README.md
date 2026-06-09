# CQUPT-SRC Claude Code Toolkit

这个目录用于让 Claude Code 在大项目中保持稳定开发节奏：少读噪声文件，按任务读取正确入口，使用专门 agents 做审查，并用 commands 固化常用工作流。

## 目录说明

- `settings.local.json`：本机权限限制，已被 `.gitignore` 忽略，不建议提交。
- `commands/`：Claude Code 自定义斜杠命令，适合反复执行的项目工作流。
- `agents/`：Claude Code 项目专属子代理，用于后端、前端、安全、Prisma、测试证据等专项审查。

## 推荐使用方式

### 自动复测开发

优先使用：

```text
/ai-retest-implement phase-1
```

每阶段完成后使用：

```text
/done-check
/review-current-diff
```

### Prisma / 数据模型改动

使用：

```text
/safe-prisma-change <你要改的数据模型或迁移目标>
```

### 常规前后端验证

使用：

```text
/backend-build-check
/frontend-build-check
```

## 关键原则

- 不要让 Claude Code 一次性实现整个 AI 自动复测方案。
- 每次只实现一个明确阶段，并在完成后运行对应 build / validate / test。
- 不读取 `node_modules`、`dist`、`tmp`、`uploads`、`tests/e2e/evidence`、`.env` 等噪声或敏感路径。
- 涉及 AI / Hermes / 自动复测时，先读权威文档再改代码。
