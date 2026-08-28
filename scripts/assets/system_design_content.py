"""Evidence-based content used by the system-design DOCX generator."""

TECH_BASELINE = [
    ("前端", "React 19、TypeScript 5.9、React Router 7、Vite 6、Tailwind CSS 4"),
    ("交互与可视化", "Motion、Three.js、@react-three/fiber、@react-three/drei、Socket.IO Client"),
    ("后端", "NestJS 11、TypeScript 5.9、Socket.IO、Prisma 6"),
    ("数据与缓存", "PostgreSQL 16、Redis 7"),
    ("文件与安全", "S3 兼容对象存储、ClamAV 文件检测、Sharp、PDF 解析组件"),
    ("部署", "Docker 26、Nginx、Nginx Proxy Manager；测试环境为 Ubuntu 22.04"),
]

ROLES = [
    ("未登录访问者", "访问公开首页、平台规则、公告和证书验证；不接触内部业务数据。"),
    ("用户", "完成安全准入，提交和跟踪本人漏洞，查看证书与积分，使用学习、通知、聊天及用户侧 AI 能力。"),
    ("审核员", "受理、审核、复测漏洞，查看必要附件与历史记录，使用按需 AI 审核建议；不创建 Skill。"),
    ("管理员", "管理用户、证书、内容、商城、系统设置、平台 AI、系统 Skill、知识审核、聊天治理和审计。"),
]

FUNCTIONS = [
    ("公开访问", "平台介绍、规则、公告、证书真伪验证", "public routes、announcements、certificates"),
    ("身份与准入", "登录、找回密码、邮箱验证、责任书、知识答题", "auth、account、access、security-exam"),
    ("漏洞响应", "草稿、Markdown 报告、附件、提交、补充、审核、复测、归档", "vulnerabilities、attachments"),
    ("证书与激励", "证书签发/撤销/验证、积分流水、排行榜、商城兑换", "certificates、points-mall"),
    ("学习与内容", "学习资源、下载统计、公告", "learning、announcements"),
    ("通知与沟通", "站内通知、红点、邮件、即时聊天、已读状态", "notifications、chat、Socket.IO"),
    ("AI 辅助", "模型路由、用户自有模型、报告建议、审核建议、知识检索、声明式 Skill", "ai、ai-knowledge"),
    ("平台治理", "用户、权限、系统设置、仪表盘、审计日志", "users、system-settings、dashboard、audit-logs"),
]

NONFUNCTIONAL = [
    ("安全性", "服务端鉴权与 RBAC、资源归属校验、输入校验、敏感信息脱敏、密钥加密、审计留痕。"),
    ("可靠性", "关键状态变更采用事务；外部 AI、邮件和对象存储失败不得破坏核心业务状态。"),
    ("性能", "前端路由和大型场景按需加载；Redis 支撑共享限流；列表接口分页；静态资源生产构建拆包。"),
    ("可维护性", "前后端模块按领域划分，数据库迁移版本化，配置通过环境变量和系统设置管理。"),
    ("可观测性", "请求编号、结构化日志、AI 调用记录、审计日志和健康检查共同形成问题定位依据。"),
    ("兼容性", "采用响应式 Web 设计，适配常见桌面和移动视口，并支持明暗主题。"),
]

ARCH_COMPONENTS = [
    ("表现层", "公开端、用户端、审核员端、管理员端 React 页面；路由守卫、主题、全局提示和加载状态。"),
    ("接入层", "Nginx/Nginx Proxy Manager 终止 TLS、转发 HTTP 与 Socket.IO WebSocket。"),
    ("应用层", "NestJS REST 控制器、WebSocket 网关、守卫、拦截器、领域服务和事务编排。"),
    ("数据层", "Prisma 访问 PostgreSQL；Redis 提供共享状态和限流；对象存储保存原始附件。"),
    ("外部能力", "SMTP 邮件、AI 模型供应商与可选恶意文件检测；失败通过降级和审计隔离。"),
]

MODULE_DESIGNS = [
    {
        "title": "身份认证与账户安全",
        "components": "AuthModule、AccountModule、RefreshToken、EmailVerificationCode、HumanVerificationNonce",
        "flow": "用户提交凭据后，服务端校验账户状态和密码摘要，签发短期访问令牌与可撤销刷新令牌。找回密码先确认邮箱归属，再完成验证码校验和密码重置。",
        "state": "刷新令牌支持吊销；密码、邮箱和异常登录等安全事件写入审计记录。",
        "permission": "公开接口仅开放登录、验证和找回密码所需能力；账户资料修改必须基于当前身份。",
        "failure": "错误提示避免泄露账户敏感信息；限流或验证码失败时拒绝继续操作。",
        "figure": "身份认证组件与令牌生命周期图：展示浏览器、认证控制器、账户服务、Redis、PostgreSQL及邮件服务之间的调用关系。"
    },
    {
        "title": "安全准入",
        "components": "AccessModule、SecurityExamAttempt、SecurityQuestion、ResponsibilityAgreement、ResponsibilitySignature",
        "flow": "用户依次补全资料、验证邮箱、阅读并签署当前版本责任书、完成安全知识答题；服务端统一计算准入状态。",
        "state": "责任书按版本签署；答题记录保留得分和通过状态。责任书版本变化时是否要求重新签署由当前策略决定。",
        "permission": "用户仅操作本人准入数据；题库、通过分数及责任书由管理员维护。",
        "failure": "未满足准入条件时阻断受保护业务，并返回明确的待完成项目。",
        "figure": "安全准入状态图：资料、邮箱、责任书、答题四项条件汇聚为允许或拒绝访问受保护功能。"
    },
    {
        "title": "漏洞提交与草稿",
        "components": "VulnerabilityReport、VulnerabilitySubmissionDraft、VulnerabilityAttachment、S3StorageModule",
        "flow": "基础字段与 Markdown 报告保持同步；粘贴图片和补充文件作为附件上传。未提交内容保存为单一当前草稿，在恢复条件满足时提示用户继续编辑。提交前由后端执行完整性、准入和附件校验。",
        "state": "草稿与正式报告分离；成功提交后清理对应草稿，原始附件保持不变供授权人员查阅。",
        "permission": "用户仅可读取和修改本人草稿与报告；审核员和管理员按职责读取原始报告及附件。",
        "failure": "对象存储、文件检测或事务失败时不得产生半完成报告；可恢复错误通过统一提示反馈。",
        "figure": "漏洞提交时序图：用户页面、草稿接口、报告服务、附件服务、对象存储、数据库及通知服务。"
    },
    {
        "title": "漏洞审核、补充、复测与归档",
        "components": "ReviewAssignment、ReviewComment、VulnerabilitySupplement、RetestRecord、VulnerabilityEvent",
        "flow": "审核员受理报告并执行形式与技术审核，可要求补充、驳回或确认有效；修复后进入复测，最终归档。每次状态迁移同时记录事件并触发通知。",
        "state": "状态迁移由服务端规则约束，禁止客户端跳过阶段；补充材料作为独立记录关联原报告。",
        "permission": "审核员和管理员执行审核与复测；用户仅提交补充并查看本人流程。",
        "failure": "状态更新、事件、积分和通知采用事务或一致性边界处理；通知失败不回滚已完成审核，但必须写入审计。",
        "figure": "漏洞生命周期状态图：提交、审核中、待补充、有效、修复中、待复测、归档及驳回状态和合法迁移。"
    },
    {
        "title": "证书与积分激励",
        "components": "Certificate、CertificateTemplate、PointLedgerEntry、MallProduct、MallRedemption",
        "flow": "满足签发条件后由管理员签发证书；公开验证按证书编号返回最小必要信息。积分通过不可变流水累计，兑换在事务内校验库存、余额和限制。",
        "state": "证书支持有效和撤销状态；积分余额由流水聚合，兑换事件记录处理过程。",
        "permission": "证书签发和撤销、商品管理由管理员执行；用户查看本人证书、积分并申请兑换。",
        "failure": "并发兑换使用数据库约束和事务避免超卖或重复扣减；邮件失败仅记录审计。",
        "figure": "证书和积分领域关系图：漏洞、证书、积分流水、商品、兑换单及用户之间的关系。"
    },
    {
        "title": "通知、邮件与即时聊天",
        "components": "PlatformNotification、ChatConversation、ChatConversationMember、ChatMessage、Socket.IO Gateway",
        "flow": "业务事件生成站内通知并更新未读状态；重要事件按策略发送脱敏邮件。聊天通过 WebSocket 实时推送，并通过 REST 获取会话和历史消息。",
        "state": "通知按用户记录已读；聊天记录会持久化，私聊首轮消息数量和群聊管理动作受规则约束。",
        "permission": "管理员管理群聊、敏感词和会话；成员只访问所属会话。管理员可审计授权范围内的聊天记录。",
        "failure": "WebSocket 不可用时历史记录仍可读取；邮件发送失败不重试，写入审计日志。",
        "figure": "通知与聊天部署时序图：业务模块、通知服务、邮件服务、Socket.IO、Nginx 与浏览器客户端。"
    },
    {
        "title": "学习、公告与内容服务",
        "components": "LearningResource、Announcement、下载统计与内容管理接口",
        "flow": "管理员维护学习资源和公告；用户浏览、筛选和下载资源，下载行为计入真实统计。公开公告仅暴露已发布内容。",
        "state": "内容具有发布状态和时间信息；删除或下线不得破坏既有审计关联。",
        "permission": "内容维护由管理员执行，审核员和用户按发布范围读取。",
        "failure": "资源不存在或对象存储不可用时返回统一错误，不发起无效下载统计。",
        "figure": "内容发布与访问流程图：管理员、内容服务、数据库、对象存储、公开访问者和登录用户。"
    },
    {
        "title": "AI 模型运行时与用户自有模型",
        "components": "AiModelPolicy、AiProviderPreset、PlatformProviderCredential、UserProviderCredential、UserModelProfile、AiAgentRun",
        "flow": "管理员配置平台模型；用户端按策略选择平台模型或自有供应商配置。请求由后端统一编排、脱敏、路由和记录，模型切换不强制废弃既有对话。",
        "state": "密钥密文存储且不回显；运行记录保存模型、状态、使用量和错误摘要，不保存不必要的明文凭据。",
        "permission": "管理员和审核员仅使用管理员配置的平台 AI；用户是否可使用自有模型由平台策略决定。",
        "failure": "模型鉴权、超时或供应商故障返回可理解提示，不自动改变漏洞业务状态。",
        "figure": "AI 请求路由图：用户/审核员页面、AI 编排服务、模型策略、凭据服务、知识检索、Skill 与模型供应商。"
    },
    {
        "title": "AI 报告建议与审核建议",
        "components": "VulnerabilityAiAdvice、VulnerabilityAiReviewDraft、AiAgentRun、报告解析与脱敏服务",
        "flow": "用户或审核人员主动点击后才触发 AI。系统从报告中提取必要信息并脱敏，复用统一评分标准；审核场景额外生成下一步动作建议并填入可编辑审核意见。",
        "state": "评分和建议持久化，可复用既有结果；人工删除或重新生成时记录变更。最终审核结论始终由授权人员确认。",
        "permission": "用户仅对本人报告请求完善建议；审核员和管理员可请求审核建议。",
        "failure": "无法可靠脱敏的字段不发送；解析或模型失败不阻断正常提交和人工审核。",
        "figure": "AI 报告分析序列图：PDF/Markdown 解析、规则完整性校验、脱敏、模型调用、结果持久化和人工确认。"
    },
    {
        "title": "AI 知识库",
        "components": "AiProblemSession、AiKnowledgeConversation、AiKnowledgeCluster、AiKnowledgeEntry、AiKnowledgeRevision、AiKnowledgeHit",
        "flow": "已解决且具复用价值的会话进入沉淀候选；自动规则通过或管理员人工通过后形成知识条目。后续相似问题先检索相关条目，仅将命中摘要注入模型上下文。",
        "state": "知识条目保留版本、来源、审核状态、命中和反馈；被点踩的候选必须人工审核，无点赞不阻止自动判断。",
        "permission": "管理员审核和维护知识；普通用户只通过问答间接使用，不直接修改知识。",
        "failure": "检索无结果时退回普通模型回答；知识维护失败不得影响原始会话。知识数据不会创建或转化为 Skill。",
        "figure": "知识沉淀与检索闭环图：会话解决、价值判断、审核、聚类、版本化、相似检索、上下文注入、反馈。"
    },
    {
        "title": "声明式 Skill",
        "components": "AiSkill、AiSkillRevision、AiSkillFile、AiSkillToolGrant、AiSkillReview、AiConversationSkillPin",
        "flow": "系统 Skill 由管理员维护；用户可创建声明式 Skill 并提交公开申请，由人工审核。用户可将最多三个可用 Skill 固定到输入框上方并调整顺序。",
        "state": "Skill 内容和审核通过版本分离；公开范围、默认固定和启用状态由管理员控制。",
        "permission": "审核员只使用平台提供的能力，不创建 Skill；用户不能创建可执行代码型 Skill。",
        "failure": "Skill 不可用或权限变化时从可选集合移除，不破坏历史对话。Skill 与知识库保持独立。",
        "figure": "Skill 生命周期图：创建、版本、提交、人工审核、发布、固定、调用和停用。"
    },
    {
        "title": "平台管理、审计与仪表盘",
        "components": "UsersModule、SystemSettingsModule、AuditLogsModule、DashboardModule、SchoolProfile",
        "flow": "管理员集中管理用户、权限策略、外观、责任书、题库、模型和平台参数；仪表盘聚合平台资源与趋势，审计日志支持追踪重要操作。",
        "state": "设置更新后保留更新时间和修改主体；高风险设置应在服务端校验后生效。",
        "permission": "系统设置、权限和审计查询仅管理员可用；审核员仅访问职责范围内数据。",
        "failure": "配置无效时拒绝保存并返回请求编号；审计写入失败按操作风险决定阻断或记录故障。",
        "figure": "管理域组件图：用户与权限、系统设置、AI 管理、内容管理、仪表盘、审计和底层数据源。"
    },
]

MODEL_GROUPS = {
    "身份、权限与准入": ["User", "AuthorizationSource", "AuthorizationPolicy", "Role", "Permission", "RolePermission", "UserPermissionOverride", "EmailVerificationCode", "HumanVerificationNonce", "RefreshToken", "SecurityExamAttempt", "SecurityQuestion", "ResponsibilityAgreement", "ResponsibilitySignature"],
    "通知与资产": ["PlatformNotification", "Asset"],
    "漏洞响应": ["VulnerabilityReport", "VulnerabilitySubmissionDraft", "VulnerabilitySupplement", "VulnerabilityAiAdvice", "VulnerabilityAiReviewDraft", "VulnerabilityAttachment", "VulnerabilityEvent", "ReviewAssignment", "ReviewComment", "RetestRecord"],
    "证书、积分与商城": ["Certificate", "CertificateTemplate", "PointLedgerEntry", "MallProduct", "MallRedemption", "MallRedemptionEvent"],
    "学习与公告": ["LearningResource", "Announcement"],
    "AI 运行时与模型": ["AiCallLog", "AiModelPolicy", "AiProviderPreset", "UserProviderCredential", "UserProviderConsent", "UserModelProfile", "AiAgentRun", "PlatformProviderCredential", "PlatformModelRoute", "AiAgentRunStep", "AiAgentToolCall", "AiAgentUsage", "AiUserQuota"],
    "AI Skill": ["AiSkill", "AiFaqEntry", "AiActionProposal", "AiSkillCandidate", "AiSkillRevision", "AiSkillFile", "AiSkillToolGrant", "AiSkillReview", "AiConversationSkillPin", "AiSkillInstallLog"],
    "AI 知识沉淀": ["AiKnowledgeConversation", "AiKnowledgeConversationTurn", "AiProblemSession", "AiKnowledgeCluster", "AiProblemSessionTurn", "AiKnowledgeEntry", "AiKnowledgeRevision", "AiKnowledgeHit", "AiKnowledgeFeedback", "AiKnowledgeCaptureJob", "AiKnowledgeMaintenanceTask"],
    "即时聊天": ["ChatConversation", "ChatConversationMember", "ChatMessage", "ChatUserRestriction", "ChatSensitiveWord"],
    "平台治理": ["AuditLog", "SchoolProfile", "SystemSetting"],
}

CORE_MODELS = [
    "User", "Role", "Permission", "ResponsibilityAgreement", "ResponsibilitySignature",
    "SecurityQuestion", "SecurityExamAttempt", "VulnerabilityReport", "VulnerabilitySubmissionDraft",
    "VulnerabilityAttachment", "VulnerabilitySupplement", "VulnerabilityEvent", "ReviewComment",
    "RetestRecord", "Certificate", "PointLedgerEntry", "MallProduct", "MallRedemption",
    "PlatformNotification", "ChatConversation", "ChatMessage", "AiAgentRun", "AiSkill",
    "AiKnowledgeEntry", "AuditLog", "SystemSetting",
]

UI_AREAS = [
    ("公开页面", "首页、平台规则、平台公告、证书查询、关于平台；首屏资源按需加载并适配明暗主题。"),
    ("登录与账户弹窗", "登录、忘记密码、邮箱验证、账户安全；复用全局弹窗与提示服务。"),
    ("用户工作台", "待处理漏洞、审核进度、补充材料、积分、证书和下一步动作的真实数据摘要。"),
    ("漏洞提交", "基础信息与 Markdown 同步、图片粘贴、附件上传、草稿恢复、知情确认和直接提交。"),
    ("我的漏洞与证书", "紧凑列表、日期筛选、编号复制、详情、补充材料、AI 建议和证书验证。"),
    ("AI 助手", "历史会话自适应折叠、模型配置、固定 Skill、报告分析、操作卡片和首次教程。"),
    ("通知与聊天", "通知列表、未读状态、会话消息、头像、输入框自适应和实时推送。"),
    ("审核员工作台", "待审核、复测、历史、证书和按需 AI 审核建议。"),
    ("管理员工作台", "仪表盘、漏洞、证书、用户、内容、商城、审计、AI 管理和双栏系统设置。"),
]

FIGURE_PLACEHOLDERS = [
    ("3-1", "系统部署拓扑图", "A4 竖向分层图。自上而下展示浏览器、Nginx Proxy Manager、Web/Nginx 容器、NestJS 后端、PostgreSQL、Redis、S3 兼容对象存储、ClamAV及外部邮件/模型服务。HTTP 与 WebSocket 连接分别标注，外部边界使用虚线框。"),
    ("3-2", "系统总体架构图", "五层横向分组、竖向排布：表现层、接入层、应用层、数据层、外部能力。箭头仅表示调用或数据访问，不穿越节点；AI 为辅助能力，不位于漏洞状态决策主链。"),
    ("3-3", "后端模块依赖图", "按身份准入、漏洞响应、激励内容、通知沟通、AI、平台治理六个领域分组；共享 Prisma、Redis、对象存储、安全和审计模块位于底部。"),
    ("3-4", "安全架构图", "展示 TLS、CORS/安全头、JWT、RBAC、资源归属、输入校验、限流、敏感数据加密、对象存储授权、审计和备份的纵深防御关系。"),
    ("5-1", "核心数据实体关系图", "只绘制用户、漏洞、附件、补充、审核、复测、证书、积分、通知、聊天、AI 运行、知识和 Skill 核心实体；辅助日志表不展开。"),
]
