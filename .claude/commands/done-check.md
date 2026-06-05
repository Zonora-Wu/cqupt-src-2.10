# 完成前检查

在你认为任务完成之前，必须执行这个检查。不要只给总结。

## 必答清单

1. 本次改了哪些文件？每个文件为什么要改？
2. 是否改了不该改的文件？特别检查：
   - `dist/`
   - `node_modules/`
   - `tmp/`
   - `uploads/`
   - `generated/`
   - `tests/e2e/evidence/`
   - `.env` / `.env.*`
3. 是否涉及 Prisma schema / migration？
4. 是否涉及 RBAC / AuditLog / 权限点？
5. 是否涉及 AI / Hermes / Runner / 敏感数据？
6. 是否需要更新 docs？如果需要，是否已更新？
7. 是否有用户未提交改动被覆盖的风险？

## 必跑验证

按实际影响选择：

- 后端改动：`cd backend && npm run build`
- Prisma 改动：`cd backend && npm run prisma:validate`
- 前端改动：`cd frontend && npm run build`
- 前端 lint 相关改动：`cd frontend && npm run lint`
- AI Problem Session / KB 改动：`cd backend && npm run test:ai-problem-session`

如果某条命令没跑，必须说明原因，不要写“应该可以”。

## 输出格式

```text
完成状态：完成 / 未完成 / 需要用户确认

文件改动：
- path：原因

验证：
- command：真实结果摘要

风险与未验证项：
- ...

下一步建议：
- ...
```
