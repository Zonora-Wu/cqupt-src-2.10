# AI 知识沉淀与 Hermes Skill 生命周期

## 目标

已解决 AI 对话先沉淀为平台知识。只有满足自动入库边界的低风险、稳定知识，才会由 Hermes 自动生成并发布 Skill。其余知识不会自动影响 Agent，只会成为管理员可审核的新建 Skill 草案。

## 入库边界

自动链路必须同时满足：

- 知识状态为 `AUTO_APPROVED`，来源于稳定问题簇。
- 角色范围明确，不能是跨角色 `ALL`。
- 敏感等级不是 `SENSITIVE`，安全分不低于 `0.90`，隐私风险不高于 `0.10`。
- 类别仅限 `PLATFORM_USAGE`、`SRC_RULES`、`SECURITY_LEARNING`、`VULNERABILITY_REPORTING`。

真实资产、凭证、附件原文、绕权或利用细节不满足自动发布条件，必须人工审核。

## 新建与更新判定

自动入库知识按以下顺序决定目标：

1. 相同知识簇已绑定已发布 Skill：更新该 Skill。
2. 同角色、同 AI 空间的已发布 Skill 与知识标题、问题、标签和内容语义相似度大于等于 `0.82`：更新该 Skill。
3. 其他情况：新建 Skill。

角色、AI 空间或安全边界不一致时不会更新旧 Skill。相似度不足也不会强行合并。未通过自动入库判断、但被管理员沉淀为知识的内容，固定创建新的 `DRAFT`，不更新既有 Skill。

## 生成与发布

1. 后端向 Hermes OpenAI 兼容接口请求 `SKILL.md`。
2. 返回内容经过长度、敏感凭证、提示词注入、绕权和破坏性命令检查。
3. 自动链路生成 `APPROVED` 候选并写入 Hermes 挂载目录；人工链路保持 `DRAFT`。
4. 同步成功后写入 `AiSkill`、`AiSkillRevision`、`AiSkillInstallLog` 和 `AuditLog`。
5. 运行时仅加载 `PUBLISHED` 且角色匹配的 Skill；按用户问题关键词命中后注入当前 Hermes 对话。

生成或同步失败会保留失败候选和错误信息，不会发布半成品 Skill。

## 管理员审计

管理员在“AI 知识沉淀审核 -> Skill”中可查看：

- 候选来源：自动入库、人工入库草案或管理员创建。
- 操作类型：新建或更新；判定理由和相似度。
- 目标 Skill、当前版本、安装路径和同步异常。
- 已发布 Skill 的版本记录、来源知识数量、版本时间和操作类型。

## 部署

数据库迁移和后端发布必须同时执行：

```bash
cd /home/cocking/projects/cqupt-src-2.10/backend
npm run prisma:migrate:deploy
npm run prisma:generate
npm run build
```

确认 `CQUPT_HERMES_SKILLS_ROOT` 指向 Hermes 容器挂载的宿主机目录。默认值保留为旧目录；生产环境应使用平台实际挂载目录，例如：

```bash
export CQUPT_HERMES_SKILLS_ROOT=/home/cocking/cqupt-src-hermes-linux/platform-skills/cqupt-src
```

Hermes 生成接口使用现有 `OPENAI_BASE_URL`、`OPENAI_API_KEY` 和 `OPENAI_MODEL`，也兼容 `HERMES_AGENT_BASE_URL`、`HERMES_AGENT_API_KEY` 和 `HERMES_AGENT_MODEL`。
