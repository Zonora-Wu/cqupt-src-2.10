# Claude Code 可用性与瘦身探针

用于检查 Claude Code 是否能正常读取核心开发文件，以及是否遵守项目瘦身规则。

## 正向探针

只使用 Read/Glob/Grep 检查这些路径是否可见：

- `backend/src/app.module.ts`
- `frontend/src/App.tsx`
- `database/prisma/schema.prisma`
- `docs/HERMES_RUNTIME.md`
- `docs/plans/AI_VULNERABILITY_RETEST_IMPLEMENTATION_PLAN.md`
- `tests/e2e/ai-problem-session-phase2.mjs`

如果看不到上述任一路径，判定为 FAIL，因为会影响开发。

## 反向探针

确认你不会默认读取这些路径内容：

- `node_modules/`
- `backend/dist/`
- `frontend/dist/`
- `tmp/logs/`
- `tests/e2e/evidence/`
- `uploads/`
- `.env` / `.env.*`

不要输出任何秘密内容。只报告是否可见/是否读取。

## 输出格式

```text
Claude Code 可用性：PASS / FAIL

核心文件可见性：
- path：OK / FAIL

噪声路径控制：
- path：OK / FAIL

结论：
- 是否可以继续开发
- 如果不能，阻塞原因是什么
```
