# Prisma

这里存放正式数据库 schema。

当前已创建：

- `schema.prisma`
- 数据库模型说明见 `../DATABASE_DESIGN.md`

注意：Prisma CLI 已作为后端 devDependency 安装，当前 schema 已通过验证。

验证命令：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run prisma:validate
```

生成 Prisma Client：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run prisma:generate
```

说明：

- schema 文件保留在 `database/prisma/schema.prisma`。
- Prisma Client 生成到 `backend/node_modules/@prisma/client/.prisma/client`。
- 生成命令通过 `backend/scripts/prisma-generate.cjs` 执行，避免 Prisma 在项目根目录误生成 `package.json` 和 `node_modules`。

当前已创建并应用初始 migration：

```text
database/prisma/migrations/20260429080513_init/migration.sql
```

本地开发数据库端口：

```text
127.0.0.1:15432
```

本地执行迁移：

```powershell
cd D:\Code\CQUPT_SRC\cqupt-src-2.10\backend
npm.cmd run prisma:migrate:dev -- --name init
```

说明：迁移脚本默认 `--skip-generate`，避免 Prisma 因 schema 位于 `database/prisma` 而在项目根目录误生成 `package.json` 和 `node_modules`。需要生成 Client 时单独执行 `npm.cmd run prisma:generate`。

当前授权模型：

- `AuthorizationLevel`：`BASIC` / `TRUSTED` / `STAFF`
- `AuthorizationSource`：可配置授权来源
- `AssetScope`：`PUBLIC` / `INTERNAL` / `SPECIAL`
- `AuthorizationPolicy`：授权等级与资产范围的访问策略

用户资料当前只保留学院，不再保留专业字段。
