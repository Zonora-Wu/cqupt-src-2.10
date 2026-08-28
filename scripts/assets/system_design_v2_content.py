"""Technical content for the V2.10 system design specification."""

TECHNOLOGY = [
    ("客户端表现层", "React 19.2.5、TypeScript 5.9.3、React Router 7.18.1、Tailwind CSS 4.1.14", "前端依赖与构建配置基线"),
    ("构建与资源优化", "Vite 6.2.0；React、Three.js、Motion、Socket.IO 独立分包", "生产构建配置基线"),
    ("三维与动效", "Three.js 0.184.0、@react-three/fiber 9.6.1、@react-three/drei 10.7.7、Motion 12.23.24", "交互与三维渲染依赖基线"),
    ("应用服务层", "NestJS 11、TypeScript 5.9、Express 适配器、Socket.IO 4.8.3", "服务端依赖与模块配置基线"),
    ("数据访问层", "Prisma 6、PostgreSQL", "数据模式与迁移基线"),
    ("缓存与共享状态", "Redis 7；承担共享限流与短期运行状态", "运行配置与健康检查基线"),
    ("对象与文件处理", "S3 兼容对象存储、ClamAV 1.4、Sharp、pdf-parse、pdf-lib", "文件处理与对象存储配置基线"),
    ("部署接入", "Linux、Docker、反向代理与 Web 服务", "部署架构与运行配置基线"),
]

FUNCTION_DOMAINS = [
    ("身份认证与账户", "密码/邮箱验证码登录、注册、刷新令牌、退出、找回密码、资料与账户安全"),
    ("安全准入", "资料完整度、邮箱验证、责任书版本签署、安全知识答题及受保护功能准入"),
    ("漏洞响应", "单一草稿、Markdown 报告、附件、提交、补充、审核、修复、复测、归档"),
    ("证书与激励", "证书签发、撤销、预览、公开验证、积分流水、排行榜、商品与兑换"),
    ("学习与公告", "学习资源发布与下载统计、公告分范围发布和公开展示"),
    ("通知与聊天", "站内通知、菜单未读状态、重要邮件、私聊、群聊、全体群及治理"),
    ("AI 辅助", "平台模型与 BYOK、AI Run、漏洞报告建议、审核建议、工具调用与人工确认"),
    ("知识库与 Skill", "已解决会话沉淀、检索增强、版本维护；声明式 Skill 创建、审核、发布与固定"),
    ("平台治理", "用户权限、系统设置、仪表盘、内容治理和审计日志"),
]

NONFUNCTIONAL = [
    ("安全性", "服务端 JWT、RBAC、资源归属、状态前置条件、输入限制、文件检测、出站脱敏、密钥加密与审计共同形成纵深防护。"),
    ("一致性", "漏洞状态、事件、证书、积分、兑换、通知记录等关联写入使用 Prisma 事务或显式提交后派发边界。"),
    ("可用性", "AI、SMTP 等辅助依赖失败不得改变核心漏洞状态；WebSocket 失效时保留 REST 历史读取能力。"),
    ("性能", "路由与大型场景按需加载，生产构建拆分大依赖；列表分页；Redis 支撑多实例共享限流。"),
    ("可观测性", "X-Request-Id、慢请求/错误请求结构化日志、AuditLog、AiAgentRun、AiCallLog 和健康检查构成追踪链。"),
    ("兼容性", "响应式 Web 页面支持常见桌面与移动视口、明暗主题、减少动态效果偏好和低性能设备降级。"),
    ("容量与恢复", "业务数据与对象文件实施联合备份；容量阈值、备份周期、保留期限、恢复点目标和恢复时间目标纳入部署配置与运行维护制度。"),
]

MODULES = [
    {
        "number": "4.1", "title": "身份认证与令牌管理",
        "files": ["backend/src/modules/auth/auth.controller.ts", "backend/src/modules/auth/auth.service.ts", "backend/src/modules/auth/jwt-auth.guard.ts", "backend/src/modules/auth/auth.validation.ts", "backend/src/common/crypto/password.ts", "backend/src/common/crypto/jwt.ts"],
        "components": [
            ("接口层", "AuthController", "提供密码登录、邮箱验证码登录、注册、密码重置、令牌刷新、退出和当前身份查询接口。"),
            ("业务层", "AuthService", "验证账户状态与凭据，签发访问令牌，持久化和轮换刷新令牌，记录登录安全事件。"),
            ("守卫层", "JwtAuthGuard、PermissionsGuard", "恢复当前用户并执行权限点校验；权限不足时返回缺失权限编码。"),
            ("密码与令牌", "password.ts、jwt.ts", "使用 Node.js crypto 完成密码派生、HMAC 签名和常量时间比较。"),
            ("数据层", "User、RefreshToken、EmailVerificationCode、HumanVerificationNonce、AuditLog", "保存身份、验证码、可撤销会话和审计数据。"),
        ],
        "design": [
            "密码登录入口为 POST /api/auth/login/password。服务端先通过 auth.validation.ts 校验统一认证码为 7 位数字、密码长度为 8 至 128 个字符且至少包含字母、数字、符号中的两类，再由 AuthService 查询用户、验证密码摘要和账户状态。",
            "访问令牌和刷新令牌使用不同密钥。env.ts 强制两个 JWT 密钥长度不少于 32 个字符、不得为示例占位值且必须互不相同。刷新令牌持久化后可按会话撤销，退出操作不只依赖前端删除令牌。",
            "邮箱验证码用于登录、注册和密码重置。发送重置验证码前先确认邮箱已绑定平台账户；验证码只保存验证所需摘要和有效期，接口配合人机验证与限流，防止批量枚举和轰炸。",
            "认证接口响应设置 Cache-Control: no-store。登录、退出和账户安全相关事件写入 AuditLog；HTTP 错误通过 X-Request-Id 与结构化日志关联。",
        ],
        "transactions": "刷新令牌创建、轮换、撤销及关联登录审计在服务端完成；任何验证失败均不得生成有效会话。",
        "uml": "登录与刷新令牌时序图。参与者：浏览器、AuthController、AuthService、HumanVerification、Prisma/PostgreSQL、邮件服务。分别绘制密码登录、刷新令牌轮换和退出吊销三条路径。",
    },
    {
        "number": "4.2", "title": "账户资料与安全准入",
        "files": ["backend/src/modules/account/account.controller.ts", "backend/src/modules/access/access.controller.ts", "backend/src/modules/access/access-policy.service.ts", "backend/src/modules/security-exam", "frontend/src/components/access"],
        "components": [
            ("账户接口", "AccountController", "查询资料、更新基础信息、修改密码/邮箱、上传头像和查询本人审计记录。"),
            ("准入接口", "AccessController", "返回准入状态、责任书当前版本、签署结果及安全答题提交入口。"),
            ("策略服务", "AccessPolicyService", "统一计算资料、邮箱、责任书和答题四项条件，阻断不满足条件的漏洞提交。"),
            ("题库服务", "SecurityExamModule", "按管理员维护题库生成随机题卷并在服务端计分，不接受客户端直接上报分数。"),
        ],
        "design": [
            "准入状态由服务端实时计算，前端弹窗只展示结果。AccessPolicyService 读取用户资料、emailVerifiedAt、当前生效责任书及签名记录、已通过答题记录，返回 missingRequirements。",
            "责任书按版本发布和签署。ResponsibilityAgreement 保存 Markdown 内容、版本与生效状态，ResponsibilitySignature 保存用户、协议版本、签署时间和必要审计上下文，避免管理员修改正文后沿用旧签名。",
            "题型由 SecurityQuestionType 约束为单选、判断和多选。默认卷为 10 道单选、5 道判断、5 道多选，满分 100 分、默认 80 分通过；实际通过分数以系统设置和当前题卷为准。",
            "用户关闭答题或责任书弹窗时由前端二次确认，但准入安全性不依赖弹窗；任何直接调用漏洞提交接口的请求仍由后端策略校验。",
        ],
        "transactions": "责任书发布、签署和审计记录在事务内写入；答题结果由服务端根据题目快照计算并持久化。",
        "uml": "安全准入活动图与责任书签署时序图。四项准入条件汇聚到受保护功能守卫，明确失败后返回待完成事项。",
    },
    {
        "number": "4.3", "title": "漏洞草稿、Markdown 报告与提交",
        "files": ["backend/src/modules/vulnerabilities/vulnerabilities.controller.ts", "backend/src/modules/vulnerabilities/vulnerability-drafts.service.ts", "backend/src/modules/vulnerabilities/vulnerability-markdown.service.ts", "backend/src/modules/vulnerabilities/vulnerabilities.service.ts", "frontend/src/pages/user/UserSubmitVulnerability.tsx"],
        "components": [
            ("草稿接口", "VulnerabilitiesController /drafts", "创建、读取、更新、删除和提交当前用户草稿。"),
            ("草稿服务", "VulnerabilityDraftsService", "维护单一未提交草稿、版本号和过期状态，使用乐观并发防止覆盖。"),
            ("Markdown 服务", "VulnerabilityMarkdownService", "校验固定章节、正文长度、测试边界、链接协议和私有图片引用。"),
            ("正式报告服务", "VulnerabilitiesService", "校验准入、完整度、资产和附件归属，创建正式报告、事件、通知及审计。"),
        ],
        "design": [
            "基础字段与 Markdown 文档双向同步，标题位于文档顶部，影响资产、漏洞类型、复现步骤、影响评估、修复建议和测试边界形成结构化章节。影响评估和修复建议均至少 10 个有效字符。",
            "正式 Markdown 长度为 80 至 50000 个字符，不允许原始 HTML；外部链接只允许 HTTPS。测试边界必须保留平台默认声明，触发请求包与利用证明至少填写一项。Markdown 图片只能引用属于当前草稿或报告的私有 INLINE_IMAGE 附件。",
            "草稿更新携带 version。VulnerabilityDraftsService 使用条件更新保证版本匹配，不匹配时返回 409，提示用户刷新，避免多个标签页或旧页面覆盖新内容。草稿过期或提交成功后不再作为可恢复草稿。",
            "提交动作通过 POST /api/vulnerabilities/drafts/:draftId/submit 完成。后端先执行安全准入、报告完整性、附件归属和状态检查，再在事务中创建 VulnerabilityReport、迁移附件关系、记录 VulnerabilityEvent 与 AuditLog，并产生站内通知。",
        ],
        "transactions": "草稿转正式报告是单一事务边界；对象存储文件已先上传，事务失败时由清理策略处理孤立对象，数据库不得产生半提交报告。",
        "uml": "漏洞草稿与提交时序图。参与者：提交页面、VulnerabilitiesController、VulnerabilityDraftsService、MarkdownService、AccessPolicyService、AttachmentsService、Prisma、NotificationDeliveryService。",
    },
    {
        "number": "4.4", "title": "附件上传、预览与访问控制",
        "files": ["backend/src/modules/attachments/attachments.controller.ts", "backend/src/modules/attachments/attachments.service.ts", "backend/src/common/security/malware-scan.service.ts", "backend/src/integrations/object-storage/s3-storage.service.ts"],
        "components": [
            ("上传入口", "AttachmentsController", "分别处理正式报告、草稿、补充材料附件上传，以及预览、下载和草稿附件删除。"),
            ("校验服务", "AttachmentsService", "验证真实文件类型、大小、数量、归属、Markdown 图片关系和敏感附件权限。"),
            ("恶意文件检测", "MalwareScanService", "通过 ClamAV 检测上传内容，检测结果参与接收决策。"),
            ("对象存储", "S3StorageService", "使用对象键访问 S3 兼容存储，不向前端暴露永久公开地址。"),
        ],
        "design": [
            "上传限流按用户和场景区分：正式附件每小时 20 次、草稿附件每小时 60 次、补充附件每小时 30 次。草稿正文图片与补充附件分别计数和计算总大小。",
            "正文图片只接受经内容嗅探确认的 PNG、JPEG 或 WebP；补充附件只接受真实 PDF、ZIP、TXT 或 HAR。AI 报告解析入口仅接受真实 PDF，单文件不超过 10 MB；普通报告文件上限由对应接口的校验常量控制。",
            "下载和预览先查询附件与报告关系。报告所有者可读取本人附件；审核员或管理员必须具有 attachment:read_sensitive 权限。每次敏感附件查看写入 VIEW_SENSITIVE_ATTACHMENT 审计。",
            "原始 PDF 和附件不因 AI 脱敏而修改。AI 只接收后端解析后的必要文本；无法可靠脱敏的参数不发送，人工审核仍读取原始附件。",
        ],
        "transactions": "对象上传成功后，在数据库事务中创建附件元数据和审计记录；元数据写入失败时必须清理对象或进入孤立对象维护流程。",
        "uml": "附件上传与授权下载时序图。分别展示文件类型识别、ClamAV、对象存储、元数据事务及敏感附件审计。",
    },
    {
        "number": "4.5", "title": "漏洞审核、补充、复测与归档",
        "files": ["backend/src/modules/vulnerabilities/vulnerabilities.controller.ts", "backend/src/modules/vulnerabilities/vulnerabilities.service.ts", "backend/src/modules/vulnerabilities/vulnerability-state-machine.ts", "frontend/src/pages/admin/AdminVulnerabilityManagement.tsx"],
        "components": [
            ("审核队列", "review-queue、manage", "按角色返回待审核或全量报告，执行分页、筛选和必要脱敏。"),
            ("审核操作", "POST /vulnerabilities/:reportId/review", "接收 ReviewDecision、等级和审核意见，校验当前状态和权限。"),
            ("补充材料", "POST /vulnerabilities/my/:reportId/supplement", "仅报告所有者在 NEEDS_SUPPLEMENT 阶段补充 Markdown 与附件。"),
            ("复测归档", "retest、mark-fixing", "记录复测结果，按规则转入修复、待复测、归档或退回修复。"),
        ],
        "design": [
            "VulnerabilityStatus 定义 DRAFT、SUBMITTED、PENDING_REVIEW、NEEDS_SUPPLEMENT、CONFIRMED、FIXING、PENDING_RETEST、ARCHIVED、CERTIFIED、REJECTED。客户端不得直接指定目标状态，服务端根据 ReviewDecision 和当前状态计算迁移。",
            "审核决定包括 CONFIRM、NEEDS_SUPPLEMENT、REJECT、RETEST_PASS、RETURN_TO_FIX 和 ARCHIVE。确认有效时必须形成最终等级；要求补充和驳回必须提供足以让用户理解的审核意见。",
            "每次状态变化写入 VulnerabilityEvent，审核意见写入 ReviewComment，复测记录写入 RetestRecord。状态、事件、审核记录、必要积分和站内通知记录在事务内建立；事务提交后派发实时通知和邮件。",
            "要求补充、审核驳回、确认有效、归档和证书签发均向用户产生重要通知。邮件只包含漏洞编号、标题和脱敏摘要，不发送完整漏洞原文；发送失败不重试，记录 NOTIFICATION_DELIVERY 审计。",
        ],
        "transactions": "审核状态、事件和审核记录必须原子提交；通知派发采用提交后执行，邮件故障不得回滚已完成的人工审核。",
        "uml": "漏洞生命周期状态图、审核活动图和审核时序图。状态图必须列出每条合法迁移及触发角色，不使用 AI 节点直接连接最终状态。",
    },
    {
        "number": "4.6", "title": "证书签发、撤销与公开验证",
        "files": ["backend/src/modules/certificates/certificates.controller.ts", "backend/src/modules/certificates/certificates.service.ts", "backend/src/modules/certificates/certificate.validation.ts"],
        "components": [
            ("管理接口", "CertificatesController", "查询证书、签发、撤销和预览 PDF。"),
            ("公开接口", "GET /certificates/public/:certificateNo", "无需登录，按证书编号执行格式校验、双维度限流和最小披露。"),
            ("证书服务", "CertificatesService", "验证漏洞状态和唯一签发约束，使用模板与电子印章生成 PDF。"),
            ("通知服务", "NotificationDeliveryService", "向用户、管理员和审核员生成分角色通知并处理必要邮件。"),
        ],
        "design": [
            "只有状态为 CONFIRMED、FIXING、PENDING_RETEST、ARCHIVED 或 CERTIFIED 且已确定最终等级的漏洞可以签发证书；一个漏洞最多签发一张证书。签发前必须存在已启用证书模板和电子印章。",
            "证书编号格式由 certificate.validation.ts 约束为 CQUPT-SRC-CERT-年份-6位编号。公开查询同时按来源 IP 和证书编号限流：10 分钟内每个 IP 30 次、每个证书编号 10 次。",
            "签发事务创建 Certificate、将漏洞状态更新为 CERTIFIED、写入 VulnerabilityEvent 和 AuditLog，并创建通知记录；事务提交后再发送邮件和实时通知。",
            "撤销保留证书历史记录、撤销原因、操作者和时间。公开查询只返回验证所需字段，不暴露用户联系方式、原始漏洞详情或附件。",
        ],
        "transactions": "证书、漏洞状态、事件、审计和站内通知记录原子提交；PDF 存储和邮件派发遵循可恢复的外围副作用边界。",
        "uml": "证书签发与公开核验时序图。公开核验路径必须单独展示输入格式校验、IP/编号限流和最小披露响应。",
    },
    {
        "number": "4.7", "title": "积分、排行榜与商城兑换",
        "files": ["backend/src/modules/points-mall/points-mall.controller.ts", "backend/src/modules/points-mall/points-mall.service.ts", "frontend/src/pages/user/UserLeaderboard.tsx", "frontend/src/pages/user/UserPointsMall.tsx"],
        "components": [
            ("积分查询", "points/summary、points/ledger", "返回本人积分汇总和分页流水。"),
            ("排行榜", "GET /leaderboard", "按北京时间统计全校榜，仅返回前 100 名并附当前用户排名。"),
            ("用户商城", "mall/products、mall/redemptions", "读取上架商品、创建兑换和查询本人兑换。"),
            ("管理商城", "mall/manage", "商品增删改、上下架、图片上传、兑换完成与取消。"),
        ],
        "design": [
            "积分事实来源为 PointLedgerEntry，不以可被覆盖的单一余额字段作为唯一审计依据。PointDirection 区分 IN、OUT 和 ADJUST，每笔记录包含原因、关联对象和时间。",
            "排行榜只提供全校榜，页面返回前 100 名；当前用户信息以底部固定模块展示。排名采用确定性次序，在积分相同时使用稳定的次级排序，时区统一按北京时间解释。用户不能退出公开排名。",
            "兑换前校验商品状态、库存、兑换限制和用户积分。MallRedemption 与 PointLedgerEntry 在事务内创建，库存扣减使用带条件更新或等效并发控制，避免超卖与重复扣分。",
            "取消兑换只能在允许状态下执行，并以补偿流水返还积分，不修改历史流水。商品图片存入对象存储，管理操作写入 MANAGE_MALL 审计。",
        ],
        "transactions": "库存扣减、兑换单和积分流水原子提交；重复请求通过当前状态、唯一约束和事务条件阻断。",
        "uml": "积分兑换活动图与并发兑换时序图。展示余额汇总、条件库存更新、积分流水、兑换单和失败回滚。",
    },
    {
        "number": "4.8", "title": "学习资源与公告内容",
        "files": ["backend/src/modules/learning/learning.controller.ts", "backend/src/modules/learning/learning.service.ts", "backend/src/modules/announcements/announcements.controller.ts", "backend/src/modules/announcements/announcements.service.ts"],
        "components": [
            ("学习资源", "LearningController", "用户查询资源并记录下载/点击；管理员上传封面、创建、编辑、启停和删除。"),
            ("公告公开端", "announcements/public", "只返回已发布且允许公开访问的公告。"),
            ("公告登录端", "announcements/visible", "按 ALL、STUDENTS、AUDITORS、ADMINS 范围过滤。"),
            ("公告管理端", "announcements/manage", "具备 announcement:manage 权限的角色创建、编辑、发布和下线。"),
        ],
        "design": [
            "LearningResourceKind 区分普通资源和范围型内容。用户实际触发下载时调用 click 接口更新统计，页面展示不提前计数，保证学习趋势数据来自真实下载行为。",
            "AnnouncementStatus 区分 DRAFT、PUBLISHED 和 OFFLINE；AnnouncementRange 控制可见角色。公开接口与登录接口分离，避免在公开响应中携带管理字段。",
            "资源文件和封面通过对象存储管理；记录不存在、资源被禁用或文件不可用时不增加下载次数。公告发布与下线均记录操作者和时间。",
        ],
        "transactions": "内容状态更新与审计记录保持一致；对象上传失败不得创建指向无效对象键的资源。",
        "uml": "学习资源发布与下载活动图、公告范围过滤时序图。",
    },
    {
        "number": "4.9", "title": "站内通知、邮件与菜单未读状态",
        "files": ["backend/src/modules/notifications/notifications.controller.ts", "backend/src/modules/notifications/notifications.service.ts", "backend/src/modules/notifications/notification-delivery.service.ts", "frontend/src/hooks/useNotificationBadges.ts"],
        "components": [
            ("通知读取", "NotificationsController", "查询本人通知，按通知、频道或业务实体标记已读。"),
            ("通知创建", "NotificationDeliveryService", "由业务事务创建 PlatformNotification 并记录邮件要求和路由范围。"),
            ("派发", "提交后派发", "事务提交后发送 Socket.IO 事件与必要邮件，防止通知先于业务状态可见。"),
            ("前端红点", "通知徽标 Hook", "铃铛和对应业务菜单共享未读来源，浏览或标记已读后同步清除。"),
        ],
        "design": [
            "PlatformNotification 保存用户、频道、业务实体、事件键、标题、脱敏摘要、路由、菜单范围、已读时间和邮件状态。事件键用于防止同一业务事件重复生成通知。",
            "用户侧重要事件包括要求补充、审核驳回、确认有效、归档和证书签发。管理员与审核员的新漏洞等普通事件仅站内通知；密码、邮箱、管理员异地 IP 登录等安全事件按策略发送邮件。",
            "邮件内容除漏洞编号和标题外不发送完整敏感信息。发送失败不自动重试，写入 AuditAction.NOTIFICATION_DELIVERY，保留请求和事件关联。",
            "标记实体已读用于用户查看漏洞或证书详情后清理对应菜单红点；AI 管理等管理页面使用独立管理已读游标，避免仅进入页面但未完成读取时错误清零。",
        ],
        "transactions": "业务事务内只创建通知记录；dispatchAfterCommit 在提交后执行外部邮件和实时推送。",
        "uml": "业务事件到站内通知、菜单红点和邮件的发布时序图，明确事务内创建与提交后派发边界。",
    },
    {
        "number": "4.10", "title": "即时聊天与治理",
        "files": ["backend/src/modules/chat/chat.controller.ts", "backend/src/modules/chat/chat-admin.controller.ts", "backend/src/modules/chat/chat.gateway.ts", "backend/src/modules/chat/chat.service.ts", "backend/src/modules/chat/chat-realtime.publisher.ts"],
        "components": [
            ("REST 接口", "ChatController", "初始化、联系人搜索、会话、历史消息、发送、已读和会话管理。"),
            ("实时网关", "ChatGateway", "鉴权后加入 user、conversation、admin 和 global 房间，推送消息与状态事件。"),
            ("治理接口", "ChatAdminController", "查看全量会话、限制用户、敏感词、容量、清理预览、导出与删除。"),
            ("业务服务", "ChatService", "执行成员资格、三条首轮限制、群聊权限、敏感词拦截、限流、持久化和审计。"),
        ],
        "design": [
            "用户、审核员和管理员均需 chat:use。用户可按统一认证码搜索其他用户；管理员和审核员作为可直接联系的工作人员展示。对方回复前最多发送三条消息，限制跨日不重置，发送前和达到上限后均在会话内提示规则。",
            "会话类型包括 DIRECT、GROUP、GLOBAL。只有管理员可创建群聊、加人、踢人、改名、关闭、重开和解散；普通群上限 200 人，全体群由平台维护。审核员和用户只能在所属会话发言。",
            "发送消息先检查会话状态、成员、用户限制、双窗口限流和敏感词。命中敏感词时阻止写入正常消息，向发送者返回原因并记录 CHAT_MESSAGE_BLOCKED 审计。",
            "消息成功持久化后通过 conversation 房间和 user 房间推送；已读状态由 ChatConversationMember 维护。数据库容量达到配置配额的 80% 时提醒管理员，可预览并按日期清理，清理前可选导出。",
        ],
        "transactions": "消息记录、会话更新时间和必要审计在事务中保持一致；WebSocket 推送发生在持久化成功后。",
        "uml": "私聊发送时序图、群聊管理活动图和 Socket.IO 房间拓扑图，展示反向代理的 WebSocket 升级转发边界。",
    },
    {
        "number": "4.11", "title": "AI 模型策略、BYOK 与运行时",
        "files": ["backend/src/modules/ai/ai-model.controller.ts", "backend/src/modules/ai/ai-model.service.ts", "backend/src/modules/ai/ai-runtime-control.service.ts", "backend/src/modules/ai/ai.service.ts", "backend/src/modules/ai/ai.tools.registry.ts"],
        "components": [
            ("模型策略", "AiModelController、AiModelService", "维护平台模型、供应商预设、用户凭据、模型配置和三档用户模型策略。"),
            ("运行编排", "AiService", "创建 AiAgentRun，选择模型、知识和 Skill，限制工具，记录步骤、用量和错误。"),
            ("运行控制", "AiRuntimeControlService", "持久化运行状态，支持查询和取消，避免重复执行已结束 Run。"),
            ("工具注册与授权守卫", "AiToolsRegistry、AiGuards", "按角色和运行模式暴露受控工具；写操作必须形成 AiActionProposal 并由用户确认。"),
        ],
        "design": [
            "AiUserModelPolicy 支持 USER_PLATFORM_ONLY、USER_BYOK_ONLY 和 USER_HYBRID。管理员与审核员始终使用管理员配置的平台 AI；用户在策略允许时可配置官方、聚合或中转供应商，同一供应商允许多个 Key。平台不检测用户模型能力。",
            "AI_CREDENTIAL_ENCRYPTION_KEY 必须解码为 32 字节。用户和平台 API Key 以密文保存，读取接口只返回掩码和元数据。用户配置供应商名称、官网、API 地址、默认模型和 JSON 预览，服务端仍校验出站 URL，阻止危险内网地址和不受控协议。",
            "每次模型请求创建 AiAgentRun，并按步骤记录 AiAgentRunStep、AiAgentToolCall 和 AiAgentUsage。模型切换不强制新建业务会话；后端按本次请求的模型配置继续使用已保存对话上下文。",
            "AI 工具按角色分层。普通问答不自动获得管理数据；审核员只获得审核域只读工具；写操作不能由模型直接执行，必须返回可审查的 AiActionProposal，经人工确认后调用受控服务。",
        ],
        "transactions": "运行、步骤、用量和审计分阶段持久化；取消和最终状态使用条件更新，避免已结束任务被重复改写。",
        "uml": "AI 请求路由组件图与运行时序图。展示模型策略、凭据解密、知识检索、Skill 路由、工具守卫、供应商、用量记录和取消控制。",
    },
    {
        "number": "4.12", "title": "漏洞报告 AI 建议与审核建议",
        "files": ["backend/src/modules/ai/ai.controller.ts", "backend/src/modules/ai/ai.report-draft.service.ts", "backend/src/modules/ai/ai.service.ts", "frontend/src/pages/user/UserAIAssistant.tsx"],
        "components": [
            ("报告草稿", "AiReportDraftService", "接收多个 PDF，逐个解析文本并形成候选草稿，用户最终选择一个。"),
            ("用户建议", "report-analysis、vulnerability-advice", "按统一评分规则返回完善建议，符合提交完整度时提供可编辑提交卡片。"),
            ("审核建议", "auditor/vulnerability-advice", "审核员或管理员主动点击后生成评分、建议动作和可编辑审核意见。"),
            ("持久化", "VulnerabilityAiAdvice、VulnerabilityAiReviewDraft", "保存评分、建议、生成上下文摘要和审核意见草稿。"),
        ],
        "design": [
            "PDF 在后端使用 pdf-parse 提取文本。扫描件或图片型 PDF 文本过少时返回明确提示，但是否含图片不能导致整条链路崩溃。每个候选漏洞传给模型的关键信息最多 5000 字，超过部分在后端压缩或截取并通过全局通知提示。",
            "发送模型前执行字段级脱敏，公网资产同样脱敏；无法可靠脱敏的参数直接省略，建议链路继续并在结果中说明限制。原始 PDF 仍作为正式漏洞附件保存，审核员和管理员按原权限查看。",
            "Agent 评分用于报告质量，不代表漏洞有效性、严重等级或最终审核结果。后端完整度校验独立执行，达到提交条件时所有必填结构字段必须完整，用户在 AI 会话内勾选知情确认后直接创建漏洞，不跳转提交页。",
            "审核建议只在点击按钮后消耗 Token。AI 扮演辅助审核员，返回建议确认有效、要求补充或驳回及其理由；结果持久化并自动填入审核意见框，但最终动作必须由审核员或管理员确认。",
        ],
        "transactions": "AI 结果先持久化为建议或草稿；正式漏洞提交和人工审核仍走漏洞模块事务，不由模型回调直接改变状态。",
        "uml": "PDF 报告解析和用户直接提交时序图、审核员按需 AI 建议时序图。两图必须标出后端完整度校验与 Agent 评分相互独立。",
    },
    {
        "number": "4.13", "title": "AI 知识沉淀与检索增强",
        "files": ["backend/src/modules/ai-knowledge/ai-problem-session.controller.ts", "backend/src/modules/ai-knowledge/ai-problem-session.service.ts", "backend/src/modules/ai-knowledge/ai-knowledge.service.ts", "backend/src/modules/ai-knowledge/ai-knowledge-retrieval.service.ts", "database/prisma/migrations/20260810193000_detach_ai_knowledge_from_skills/migration.sql"],
        "components": [
            ("问题会话", "AiProblemSessionService", "保存问答轮次、解决确认、冷却期、总结、价值评分和人工审核状态。"),
            ("知识管理", "AiKnowledgeService", "知识创建、审核、反馈、版本、恢复、统计和管理未读状态。"),
            ("检索服务", "AiKnowledgeRetrievalService", "按角色、分类、可见性、敏感等级和相似度召回有限知识摘要。"),
            ("维护任务", "AiKnowledgeMaintenanceWorker", "扫描陈旧、低质量、重复和安全问题并产生维护任务。"),
        ],
        "design": [
            "只有用户主动确认已解决、达到最少对话轮次且具复用价值的会话进入总结。离开页面、切换标签页和心跳不再无条件触发解决弹窗；稍后再问记录 7 天冷却期，继续则恢复 ACTIVE。",
            "无点赞不影响自动入库判断；存在点踩时必须进入人工审核。总结包含问题类型、可复用步骤、适用条件、限制、敏感性和质量评分，敏感内容检查失败时拒绝沉淀并保留原会话。",
            "后续问答先以轻量路由和检索条件查找候选知识，只将有限条目的摘要与必要片段注入模型上下文，记录 AiKnowledgeHit 和用户反馈。未命中时直接执行普通模型回答，不注入全部知识库。",
            "知识库与 Skill 是独立产品域。20260810193000 迁移已清除活动关联并将历史 SKILL_CANDIDATE 状态回退为 READY_REVIEW；Schema 中保留的 PROMOTED_TO_SKILL、SKILL_PROMOTION 等枚举只用于兼容历史数据，不代表现行流程。",
        ],
        "transactions": "会话轮次、反馈、总结状态和知识条目在明确事务中更新；知识检索失败不得阻断普通问答。",
        "uml": "知识沉淀活动图、检索增强时序图。不得出现知识条目转换为 Skill 的箭头；历史兼容数据只能以注释说明。",
    },
    {
        "number": "4.14", "title": "声明式 Skill 生命周期",
        "files": ["backend/src/modules/ai/ai-declarative-skill.controller.ts", "backend/src/modules/ai/ai-declarative-skill.service.ts", "backend/src/modules/ai/ai.skill-router.service.ts", "frontend/src/components/ai/AiSkillManagerModal.tsx"],
        "components": [
            ("Skill 接口", "AiDeclarativeSkillController", "列表、创建、上传、修改、删除、提交审核、启停、展示设置和对话固定。"),
            ("生命周期服务", "AiDeclarativeSkillService", "校验声明式包、版本状态、创建者权限、人工审核和发布规则。"),
            ("路由服务", "AiSkillRouterService", "按会话固定 Skill、显式选择和运行模式组装声明内容。"),
            ("管理界面", "Skill 管理弹窗", "系统 Skill 与用户 Skill 分区，详情中处理公开申请和删除，最多固定三个。"),
        ],
        "design": [
            "审核员不能创建 Skill，只能使用管理员提供的审核能力。管理员维护系统 Skill；用户可创建纯声明式 Skill 并申请公开，公开申请全部由管理员人工审核，AI 不参与审核决定。",
            "上传包根目录必须包含 SKILL.md 和 YAML Frontmatter。压缩包不超过 2 MB、最多限定数量文件、单文件不超过 512 KB；禁止软链接、隐藏路径、路径穿越、嵌套压缩包、二进制文件和非 UTF-8 内容。",
            "用户 Skill 只能申请白名单内的用户只读工具，不能包含可执行代码。管理员不能审核自己创建的 Skill；驳回或要求修改必须填写原因。已发布版本和编辑草稿通过版本关系分离。",
            "系统 Skill 可配置是否在用户侧展示及是否默认固定；用户 Skill 不能设为系统默认。用户输入框上方最多固定三个 Skill，可拖动排序，点击后本次消息显式记录所用 Skill。",
        ],
        "transactions": "创建版本、审核记录、发布状态和固定关系在事务中更新；Skill 失效不删除历史消息中的使用标记。",
        "uml": "系统 Skill 与用户 Skill 生命周期状态图、固定与调用时序图。与知识库完全分离绘制。",
    },
    {
        "number": "4.15", "title": "用户、系统设置、仪表盘与审计",
        "files": ["backend/src/modules/users/users.controller.ts", "backend/src/modules/system-settings/system-settings.controller.ts", "backend/src/modules/dashboard/dashboard.controller.ts", "backend/src/modules/audit-logs/audit-logs.controller.ts"],
        "components": [
            ("用户管理", "UsersController", "用户列表、详情、角色、状态、权限覆盖、AI 配额和密码重置。"),
            ("系统设置", "SystemSettingsController", "外观、字体、图标、邮宝头像、证书模板、责任书、题库、AI 和通知策略。"),
            ("仪表盘", "DashboardController", "按用户、审核员和管理员角色聚合待办、趋势、分布和资源数据。"),
            ("审计", "AuditLogsController", "分页查询、统计、按目标追踪和详情查看。"),
        ],
        "design": [
            "角色权限由 Role、Permission、RolePermission 和 UserPermissionOverride 组成。角色提供基线权限，用户覆盖用于受控例外；变更角色、状态和权限均要求 user:manage 并写入审计。",
            "系统设置接口统一要求 system:manage，上传字体、图标、邮宝头像、证书模板和印章时同时执行文件类型和对象存储约束。外观设置通过公共配置接口提供给前端，但不返回密钥或管理字段。",
            "管理员仪表盘的活跃趋势按登录、漏洞、AI、学习下载等真实事件聚合，各序列采用相对高度用于比较变化，悬浮展示原始数量；资源模块提供可点击业务跳转。用户仪表盘聚合本人必须处理漏洞、审核阶段、补充材料、积分、证书和下一步动作。",
            "AuditLog 记录主体、动作、目标、请求路径、IP、User-Agent、结果和必要元数据。日志接口要求 audit:read，普通用户只能通过账户安全接口读取本人允许范围的安全记录。",
        ],
        "transactions": "高风险设置和用户权限变更必须生成审计记录；与业务数据处于同一事务的审计记录保持原子一致，提交后审计或通知异常必须形成可追踪告警，不得静默丢失。",
        "uml": "RBAC 类图、系统设置组件图和审计追踪时序图。",
    },
]

UI_SECTIONS = [
    ("6.1", "未登录公共页面", "/、/rules、/announcements、/certificates、/about", "未登录访问者", "首页首屏及下方核心能力、规则、公告、证书查询和关于平台页面", "隐藏测试账号以外的真实账户信息；证书查询结果使用测试编号"),
    ("6.2", "登录、注册与找回密码弹窗", "全局身份弹窗", "未登录访问者", "登录、注册、忘记密码的字段校验、验证码和错误状态", "遮挡邮箱、验证码、访问令牌和请求详情"),
    ("6.3", "用户首页", "/user", "用户", "必须处理漏洞、审核阶段、补充材料、积分、证书和下一步动作", "仅使用测试用户脱敏数据"),
    ("6.4", "漏洞提交页面", "/user/submit", "用户", "准入完成后的 Markdown 编辑、基础字段、粘贴图片、附件和提交确认", "资产、请求包、Cookie、附件文件名脱敏"),
    ("6.5", "我的漏洞与证书", "/user/vulnerabilities、/user/certificates", "用户", "紧凑列表、日期查询、编号复制、详情、补充材料和 AI 建议入口", "漏洞标题、资产和证书身份信息使用测试数据"),
    ("6.6", "AI 助手", "/user/ai", "用户", "模型配置、Skill 固定、会话历史、消息、报告建议与操作卡片", "API Key、模型密钥、真实漏洞文本和个人信息脱敏"),
    ("6.7", "通知中心与聊天", "/user/notifications", "用户", "通知已读、私聊、群聊、头像、三条限制和实时消息", "聊天内容、统一认证码、头像和邮箱使用测试数据"),
    ("6.8", "审核员工作台", "/auditor/*", "审核员", "审核队列、复测归档、详情操作面板、AI 建议、附件与证书", "漏洞原文、附件、提交者身份和 IP 脱敏"),
    ("6.9", "管理员工作台", "/admin/*", "管理员", "仪表盘、漏洞、证书、用户、内容、商城、AI、审计和系统设置", "用户、密钥、审计 IP、邮箱和对象存储路径脱敏"),
]

UML_LIST = [
    ("图2-1", "系统总体用例图", "UML 用例图", "未登录访问者、用户、审核员、管理员及邮件/模型/对象存储外部系统"),
    ("图3-1", "系统部署架构图", "UML 部署图", "展示访问接入、容器化应用、数据服务、对象存储、安全检测和外部服务边界"),
    ("图3-2", "软件组件架构图", "UML 组件图", "前端、接入、NestJS 模块、Prisma、PostgreSQL、Redis、对象存储和外部服务"),
    ("图3-3", "后端模块依赖图", "UML 包图", "AppModule 下各业务模块与共享模块依赖"),
    ("图3-4", "核心领域模型图", "UML 类图", "用户、漏洞、附件、审核、复测、证书、积分、通知、聊天、AI、知识和 Skill"),
    ("图3-5", "安全控制架构图", "安全工程图", "TLS、反向代理、安全头、JWT、RBAC、限流、文件检测、加密、审计与备份"),
]
for module in MODULES:
    UML_LIST.append((f"图{module['number']}", f"{module['title']}工程图", "UML 时序图/活动图/状态图", module["uml"]))

UNCONFIRMED = [
    ("计算资源规格", "部署配置项", "依据容量估算、并发模型和性能验证结果确定"),
    ("容器网络与端口映射", "部署配置项", "依据网络分区、最小暴露原则和反向代理规则配置"),
    ("数据卷与备份位置", "运维配置项", "依据数据分级、备份隔离和恢复验证制度配置"),
    ("恢复点目标与恢复时间目标", "服务保障指标", "由业务连续性要求和灾难恢复方案确定"),
    ("并发、响应时间和可用性目标", "验收指标", "依据目标用户规模、业务峰值和性能测试结果确定"),
    ("日志、聊天、附件和审计保留期限", "数据治理指标", "依据管理制度、数据分类分级和存储容量确定"),
]
