# Prisma

后续放置 Prisma schema。

下一步“数据库模型设计”会在这里创建：

- `schema.prisma`
- 初始迁移
- 模型说明

当前已创建 `schema.prisma` 初稿。

注意：当前仓库还没有初始化后端依赖，也还没有安装 Prisma CLI，因此本阶段只完成模型设计。下一步初始化后端后，需要执行 Prisma validate 和 migration。

当前授权模型：

- `AuthorizationLevel`：`BASIC` / `TRUSTED` / `STAFF`
- `AuthorizationSource`：可配置授权来源
- `AssetScope`：`PUBLIC` / `INTERNAL` / `SPECIAL`
- `AuthorizationPolicy`：授权等级与资产范围的访问策略

用户资料当前只保留学院，不再保留专业字段。
