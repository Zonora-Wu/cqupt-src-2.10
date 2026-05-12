可以。按你的需求，用户端 AI 助手应该设计成 **“对话 + 业务检索 + 表单辅助填写 + 用户确认执行”** 的复合助手，而不是普通聊天框。

下面是最贴合当前项目的设计方案。

**一、用户端 AI 助手目标**

用户端 AI 助手要覆盖 3 类核心能力：

1. 漏洞提交辅助  
用户上传漏洞文档后，AI 解析文档，自动填写漏洞标题、资产、漏洞类型、复现步骤、影响评估、修复建议等字段。不确定的字段留空或标记“需用户确认”。

2. 项目内信息检索  
用户问“我想找 SQL 注入靶场”，AI 优先检索项目学习中心里的靶场资源，而不是泛泛回答网上知识。

3. 用户确认后执行操作  
用户问“我想兑换邮宝钥匙扣”，AI 检索积分商城、检查用户积分、库存、限兑规则。如果满足条件，AI 在聊天页展示确认卡片，用户点击确认后才兑换。

**二、整体交互形态**

AI 助手页不再只是纯文本对话，而是支持三种消息：

```text
1. 普通文本消息
2. 资源卡片消息
3. 待确认操作卡片
```

例如用户问：

```text
我现在想找个 SQL 注入靶场
```

AI 回复：

```text
我在学习中心找到 2 个 SQL 注入相关靶场，优先推荐这个：
```

下面展示卡片：

```text
SQL 注入基础靶场
分类：Web 靶场
说明：适合学习联合查询、布尔盲注、报错注入基础
按钮：进入靶场
```

用户问：

```text
我想兑换邮宝钥匙扣
```

AI 回复：

```text
我找到了“邮宝钥匙扣”。你当前有 320 积分，该商品需要 120 积分，库存 8 件，可以兑换。
```

下面展示确认卡片：

```text
邮宝钥匙扣
消耗：120 积分
当前积分：320
兑换后剩余：200
领取地点：蓝山工作室
按钮：确认兑换
```

只有点击按钮后，才真正调用兑换接口。

**三、推荐后端架构**

当前已有：

```text
POST /api/ai/chat
```

建议扩展为“AI 编排层”：

```text
backend/src/modules/ai/
├── ai.controller.ts
├── ai.service.ts
├── ai.prompt.service.ts
├── ai.context.service.ts
├── ai.intent.service.ts
├── ai.tools.service.ts
├── ai.actions.service.ts
├── ai.redaction.service.ts
└── ai.types.ts
```

各模块职责：

```text
ai.intent.service.ts
识别用户意图：找靶场、找学习资料、兑换商品、检查漏洞文档、普通问答。

ai.context.service.ts
从项目数据库取上下文，比如学习中心资源、积分商城商品、用户积分、用户漏洞记录。

ai.tools.service.ts
封装项目内可查询能力，比如 searchLearningResources、searchMallProducts、getPointSummary。

ai.actions.service.ts
生成“待确认动作”，用户确认后才执行，比如兑换商品、跳转靶场、填充漏洞表单。

ai.redaction.service.ts
对文档和对话内容脱敏，避免 Token、Cookie、密码、身份证号进入 Agent。
```

**四、接口设计**

新增用户端 AI 接口：

```text
POST /api/ai/chat
POST /api/ai/report/parse-document
POST /api/ai/report/check-draft
POST /api/ai/actions/:actionId/confirm
GET  /api/ai/conversations
GET  /api/ai/conversations/:id
```

其中最关键的是这几个。

**1. 文档解析接口**

```text
POST /api/ai/report/parse-document
Content-Type: multipart/form-data
```

表单：

```text
file: PDF / Markdown / TXT / DOCX
```

后端流程：

```text
上传文档
-> 校验大小和类型
-> 提取文本
-> 脱敏
-> 调用 Hermes Agent
-> 结构化返回漏洞草稿
```

返回：

```json
{
  "draft": {
    "title": "某系统存在 SQL 注入漏洞",
    "assetName": "example.cqupt.edu.cn",
    "assetUrl": "https://example.cqupt.edu.cn/search",
    "ownerUnit": "",
    "vulnerabilityType": "SQL 注入",
    "selfSeverity": "高危",
    "detailMarkdown": "## 【漏洞描述】\n...\n## 【复现步骤】\n...",
    "requestPacket": "GET /search?id=1 HTTP/1.1\nHost: example.cqupt.edu.cn"
  },
  "uncertainFields": [
    "ownerUnit",
    "selfSeverity"
  ],
  "warnings": [
    "请求包中疑似包含 Cookie，请提交前确认已脱敏。"
  ],
  "summary": "AI 已提取出标题、影响资产、漏洞类型和复现步骤，主管单位不明确，需要用户补充。"
}
```

前端效果：

```text
用户上传文档
-> AI 解析
-> 自动填入漏洞提交表单
-> 不确定字段高亮提示
-> 用户手动修改
-> 展示最终预览
-> 用户点击确认提交
```

**2. 漏洞草稿检查接口**

```text
POST /api/ai/report/check-draft
```

用于用户已经填写了一部分表单后，让 AI 检查完整度。

返回：

```json
{
  "score": 82,
  "missingItems": [
    "缺少影响范围说明",
    "缺少修复建议"
  ],
  "riskWarnings": [
    "请求包中疑似包含 SESSION 字段，请脱敏。"
  ],
  "suggestions": {
    "repairSuggestion": "建议对参数进行预编译处理，并限制数据库账号权限。"
  }
}
```

前端展示：

```text
AI 检查结果
- 完整度 82
- 缺失项
- 风险提醒
- 可一键应用的建议
```

但“提交漏洞”仍然必须由用户点击。

**3. AI 业务动作确认接口**

```text
POST /api/ai/actions/:actionId/confirm
```

用于兑换商品、打开资源、应用表单建议等。

设计重点：  
AI 不直接执行操作，而是先生成一个 `pending action`。

比如兑换钥匙扣时，后端先生成：

```json
{
  "actionId": "act_xxx",
  "type": "MALL_REDEEM",
  "status": "PENDING_CONFIRM",
  "payload": {
    "productId": "prod_xxx"
  },
  "expiresIn": 300
}
```

用户点击确认后：

```text
POST /api/ai/actions/act_xxx/confirm
```

后端再调用现有逻辑：

```text
PointsMallService.createRedemption(productId, user)
```

这样可以防止 AI 自动兑换，也能防止前端篡改商品 ID。

**五、AI 如何“得到项目中的信息”**

不建议让 Agent 直接查数据库。最贴合本项目的做法是：后端 AI Gateway 提供受控工具。

例如：

```text
searchLearningResources(keyword)
searchMallProducts(keyword)
getPointSummary(userId)
getMallRedemptionEligibility(userId, productId)
getUserDashboard(userId)
getMyVulnerabilities(userId)
```

用户问 SQL 靶场时：

```text
用户消息
-> AI Gateway 判断意图：LEARNING_RESOURCE_SEARCH
-> 后端查 LearningResource
-> 把查到的资源作为上下文传给 Agent
-> Agent 生成自然语言解释
-> 前端展示资源卡片
```

后端检索逻辑优先使用项目数据库：

```text
LearningResource.title
LearningResource.category
LearningResource.description
LearningResource.kind = RANGE
active = true
deletedAt = null
```

用户问兑换钥匙扣时：

```text
用户消息
-> 判断意图：MALL_REDEEM
-> 搜索 MallProduct
-> 查询 PointSummary
-> 检查 stock、pointsCost、perUserLimit、canRedeem
-> 生成兑换确认卡片
-> 用户确认
-> 执行兑换
```

**六、首页 AI 功能需要实现什么**

首页现在已有 AI 输入框，已经能跳转到 AI 助手并发送消息。下一步建议把首页 AI 区域做成“快捷任务入口”。

首页 AI 区域建议包含：

```text
1. 输入框
   用户自由输入，跳转 AI 助手并发送。

2. 快捷按钮
   - AI 检查漏洞报告
   - 推荐学习靶场
   - 查询可兑换奖励
   - 查看我的漏洞进度

3. AI 今日建议
   不再写静态假数据，而是来自后端：
   - 根据学习中心推荐靶场
   - 根据用户积分推荐可兑换商品
   - 根据我的漏洞状态提示补充材料
```

推荐新增接口：

```text
GET /api/ai/user-home-suggestions
```

返回：

```json
{
  "tasks": [
    {
      "type": "LEARNING",
      "title": "推荐 SQL 注入基础靶场",
      "description": "适合补齐 Web 注入基础。",
      "actionPrompt": "我想练习 SQL 注入靶场"
    },
    {
      "type": "MALL",
      "title": "你当前积分可兑换 3 件奖励",
      "description": "包含邮宝钥匙扣、笔记本等。",
      "actionPrompt": "帮我看看现在可以兑换什么"
    }
  ]
}
```

点击后直接进入 AI 助手并发送 `actionPrompt`。

**七、漏洞提交页详细流程**

推荐 UI 流程：

```text
提交漏洞页
├── 左侧：漏洞表单
├── 右侧：AI 文档助手
│   ├── 上传漏洞文档
│   ├── AI 解析状态
│   ├── 提取结果
│   ├── 不确定字段
│   ├── 脱敏风险提醒
│   └── 一键应用到表单
└── 底部：最终确认弹窗
```

操作流程：

```text
1. 用户上传 PDF / Markdown / DOCX
2. 后端提取文本并脱敏
3. AI 返回结构化草稿
4. 前端展示 AI 提取结果
5. 用户点击“应用到表单”
6. 用户补全不确定字段
7. 用户点击提交
8. 弹出最终确认
9. 用户确认
10. 调用现有 createVulnerability
11. 如有原始 PDF，再调用 uploadVulnerabilityAttachment
```

这里有个关键点：  
当前附件上传接口是：

```text
POST /api/vulnerabilities/:reportId/attachments
```

也就是说，附件必须先有漏洞报告 ID。  
所以 AI 文档解析不能直接复用这个接口，应该新建预解析接口：

```text
POST /api/ai/report/parse-document
```

这个接口只做解析，不创建漏洞，不保存正式附件。

**八、AI 助手消息结构设计**

前端 `UserAIAssistant` 的消息类型建议改成：

```ts
type AiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  cards?: AiCard[]
  actions?: AiPendingAction[]
  createdAt: string
}
```

卡片类型：

```ts
type AiCard =
  | LearningResourceCard
  | MallProductCard
  | VulnerabilityDraftCard
  | WarningCard
```

学习资源卡：

```ts
type LearningResourceCard = {
  type: 'LEARNING_RESOURCE'
  id: string
  title: string
  category: string
  description: string
  kindLabel: string
  actionLabel: '进入靶场' | '查看资源'
}
```

商品卡：

```ts
type MallProductCard = {
  type: 'MALL_PRODUCT'
  id: string
  name: string
  description: string
  pointsCost: number
  stock: number
  userBalance: number
  canRedeem: boolean
  actionId?: string
}
```

漏洞草稿卡：

```ts
type VulnerabilityDraftCard = {
  type: 'VULNERABILITY_DRAFT'
  draft: CreateVulnerabilityPayload
  uncertainFields: string[]
  warnings: string[]
}
```

**九、后端响应结构设计**

`POST /api/ai/chat` 不应该只返回 `content`，而应返回：

```json
{
  "conversationId": "conv_xxx",
  "message": {
    "role": "assistant",
    "content": "我找到了一个 SQL 注入基础靶场。",
    "cards": [
      {
        "type": "LEARNING_RESOURCE",
        "id": "lr_xxx",
        "title": "SQL 注入基础靶场",
        "category": "Web 靶场",
        "description": "...",
        "kindLabel": "靶场资源"
      }
    ],
    "actions": []
  }
}
```

对于兑换：

```json
{
  "message": {
    "role": "assistant",
    "content": "你当前积分足够兑换邮宝钥匙扣。",
    "cards": [
      {
        "type": "MALL_PRODUCT",
        "id": "prod_xxx",
        "name": "邮宝钥匙扣",
        "pointsCost": 120,
        "stock": 8,
        "userBalance": 320,
        "canRedeem": true,
        "actionId": "act_xxx"
      }
    ]
  }
}
```

**十、权限和安全边界**

必须坚持：

```text
AI 可以建议
AI 可以检索
AI 可以生成草稿
AI 可以创建待确认动作
AI 不能直接提交漏洞
AI 不能直接兑换商品
AI 不能绕过积分和库存校验
AI 不能读取用户无权访问的数据
AI 不能替用户确认最终操作
```

兑换商品时必须走现有后端校验：

```text
PointsMallService.createRedemption
```

不能让 AI 自己判断后直接扣积分。

学习资源进入时可以调用：

```text
POST /api/learning/:id/click
```

记录点击次数，然后前端打开返回的 URL。

漏洞提交时必须走：

```text
POST /api/vulnerabilities
```

AI 只负责填草稿，用户确认后提交。

**十一、数据库建议**

为了支持“AI 执行前确认”和服务端对话历史，建议新增：

```prisma
model AiConversation {
  id        String   @id @default(cuid())
  userId    String
  mode      String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  messages AiMessage[]
  actions  AiPendingAction[]
}

model AiMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String
  content        String
  cardsJson      Json?
  redacted       Boolean  @default(false)
  createdAt      DateTime @default(now())
}

model AiPendingAction {
  id             String   @id @default(cuid())
  conversationId String
  userId         String
  type           String
  payloadJson    Json
  status         String
  expiresAt      DateTime
  confirmedAt    DateTime?
  createdAt      DateTime @default(now())
}
```

`AiPendingAction.type` 可选：

```text
OPEN_LEARNING_RESOURCE
MALL_REDEEM
APPLY_VULNERABILITY_DRAFT
SUBMIT_VULNERABILITY_DRAFT
```

第一期可以只做：

```text
OPEN_LEARNING_RESOURCE
MALL_REDEEM
```

**十二、推荐开发顺序**

我建议按这个顺序实现，最稳：

```text
第一步：AI 助手支持业务卡片
- 学习资源卡
- 积分商品卡
- 确认操作卡

第二步：后端实现 AI tools
- 搜索学习资源
- 搜索积分商城
- 查询积分
- 生成待确认兑换动作

第三步：AI 助手可执行确认动作
- 进入靶场
- 确认兑换

第四步：漏洞提交页 AI 文档解析
- 上传文档
- 提取文本
- AI 生成草稿
- 用户确认应用

第五步：服务端 AI 会话历史
- 替换 localStorage
- 支持多会话
- 支持审计和清理

第六步：首页 AI 今日建议真实化
- 不再使用静态活动
- 从学习中心、积分商城、我的漏洞生成建议
```

**十三、最终用户体验**

用户问：

```text
我现在想找个 SQL 注入靶场
```

AI 应该做：

```text
1. 判断意图：找靶场
2. 搜索 LearningResource
3. 优先 kind = RANGE
4. 匹配 SQL 注入
5. 返回项目内靶场卡片
6. 用户点击进入
7. 后端记录 click
8. 打开靶场链接
```

用户问：

```text
我想兑换邮宝钥匙扣
```

AI 应该做：

```text
1. 判断意图：兑换商品
2. 搜索 MallProduct
3. 查询用户积分
4. 检查库存、积分、限兑
5. 返回商品卡片和兑换说明
6. 生成 pending action
7. 用户点击确认兑换
8. 后端执行 createRedemption
9. 返回领取码、领取地点、剩余积分
```

用户上传漏洞文档：

```text
1. AI 提取文档内容
2. 自动填表
3. 标记不确定字段
4. 提醒敏感信息脱敏
5. 用户补全
6. 用户最终确认提交
```

这套方案最贴合你的项目：它用现有学习中心、积分商城、漏洞提交、积分、审计日志这些模块，让 AI 成为平台里的“可确认业务助手”，而不是外挂聊天机器人。