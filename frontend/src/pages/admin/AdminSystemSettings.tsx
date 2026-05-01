import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle,
  DatabaseBackup,
  FileBadge2,
  FileText,
  KeyRound,
  Mail,
  Paintbrush,
  ServerCog,
  ShieldCheck,
  ShieldQuestion,
  SlidersHorizontal,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  approveRegistration,
  getActiveCertificateTemplate,
  getRegistrationMode,
  listPendingRegistrations,
  rejectRegistration,
  setRegistrationMode,
  uploadCertificateSeal,
  uploadCertificateTemplateBackground,
} from '../../services/systemSettings'
import type { CertificateTemplateSummary, PendingRegistrationItem } from '../../services/systemSettings'

type SettingsSection =
  | '基础设置'
  | '登录与认证'
  | 'AI 设置'
  | '邮箱与通知'
  | '漏洞流程'
  | '证书模板'
  | '安全与审计'
  | '系统维护'

type ConfirmState = {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
} | null

const settingSections: Array<{ label: SettingsSection; icon: ReactNode; description: string }> = [
  { label: '基础设置', icon: <Building2 className="h-4 w-4" />, description: '品牌、组织、交付方式' },
  { label: '登录与认证', icon: <KeyRound className="h-4 w-4" />, description: '注册、认证、账号安全' },
  { label: 'AI 设置', icon: <BrainCircuit className="h-4 w-4" />, description: '模型、知识库、安全边界' },
  { label: '邮箱与通知', icon: <Mail className="h-4 w-4" />, description: 'SMTP、站内信、模板' },
  { label: '漏洞流程', icon: <ShieldQuestion className="h-4 w-4" />, description: '审核流、时限、规则' },
  { label: '证书模板', icon: <FileBadge2 className="h-4 w-4" />, description: 'PDF、签章、公开核验' },
  { label: '安全与审计', icon: <ShieldCheck className="h-4 w-4" />, description: '准入、脱敏、日志' },
  { label: '系统维护', icon: <ServerCog className="h-4 w-4" />, description: '部署、备份、配置迁移' },
]

export function AdminSystemSettings() {
  const templateInputRef = useRef<HTMLInputElement | null>(null)
  const sealInputRef = useRef<HTMLInputElement | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>('基础设置')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [openRegister, setOpenRegister] = useState(true)
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistrationItem[]>([])
  const [pendingRegLoading, setPendingRegLoading] = useState(false)
  const [emailVerify, setEmailVerify] = useState(true)
  const [publicCertVerify, setPublicCertVerify] = useState(true)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiProvider, setAiProvider] = useState('OpenAI 兼容接口')
  const [defaultLogin, setDefaultLogin] = useState('统一认证码 + 密码')
  const [pdfMode, setPdfMode] = useState('后端生成 PDF')
  const [backendAccess, setBackendAccess] = useState('校园网访问')
  const [certificateTemplate, setCertificateTemplate] = useState<CertificateTemplateSummary | null>(null)
  const [certificateTemplateMessage, setCertificateTemplateMessage] = useState('')
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false)

  const confirmChange = (nextState: Exclude<ConfirmState, null>) => {
    setConfirmState(nextState)
  }

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      try {
        const [mode, template] = await Promise.all([
          getRegistrationMode(),
          getActiveCertificateTemplate(),
        ])
        if (active) {
          setOpenRegister(mode.open)
          setCertificateTemplate(template)
        }
      } catch (error) {
        if (active) {
          setCertificateTemplateMessage(error instanceof Error ? error.message : '设置信息加载失败')
        }
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [])

  // Load pending registrations when entering the auth section and registration is closed
  useEffect(() => {
    if (activeSection !== '登录与认证') return

    let active = true
    setPendingRegLoading(true)

    listPendingRegistrations()
      .then((items) => { if (active) setPendingRegistrations(items) })
      .catch(() => {})
      .finally(() => { if (active) setPendingRegLoading(false) })

    return () => { active = false }
  }, [activeSection])

  const handleApproveRegistration = async (id: string) => {
    await approveRegistration(id)
    setPendingRegistrations((prev) => prev.filter((item) => item.id !== id))
  }

  const handleRejectRegistration = async (id: string) => {
    await rejectRegistration(id)
    setPendingRegistrations((prev) => prev.filter((item) => item.id !== id))
  }

  const handleTemplateUpload = async (file: File | undefined) => {
    if (!file) return

    setCertificateTemplateMessage('')
    setIsUploadingTemplate(true)

    try {
      const template = await uploadCertificateTemplateBackground(file)
      setCertificateTemplate(template)
      setCertificateTemplateMessage('证书背景模板已上传并启用。')
    } catch (error) {
      setCertificateTemplateMessage(error instanceof Error ? error.message : '证书背景模板上传失败')
    } finally {
      setIsUploadingTemplate(false)
      if (templateInputRef.current) templateInputRef.current.value = ''
    }
  }

  const handleSealUpload = async (file: File | undefined) => {
    if (!file) return

    setCertificateTemplateMessage('')
    setIsUploadingTemplate(true)

    try {
      const template = await uploadCertificateSeal(file)
      setCertificateTemplate(template)
      setCertificateTemplateMessage('电子印章已上传并绑定到当前模板。')
    } catch (error) {
      setCertificateTemplateMessage(error instanceof Error ? error.message : '电子印章上传失败')
    } finally {
      setIsUploadingTemplate(false)
      if (sealInputRef.current) sealInputRef.current.value = ''
    }
  }

  return (
    <>
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="System Settings"
            eyebrowIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            title="系统设置"
            description="集中管理平台交付、认证、AI、证书、安全审计和维护能力。配置项实时生效；涉及注册、认证、AI、PDF、后台访问等关键配置时，会先弹出确认框。"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-semibold">设置</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">按模块管理平台配置</p>
              </div>
              <div className="p-2">
                {settingSections.map((section) => (
                  <button
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                      activeSection === section.label
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                    key={section.label}
                    onClick={() => setActiveSection(section.label)}
                    type="button"
                  >
                    <span className="mt-0.5">{section.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold">{section.label}</span>
                      <span className={`mt-1 block text-xs leading-5 ${activeSection === section.label ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
                        {section.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </SurfacePanel>
          </aside>

          <div className="space-y-6">
            {activeSection === '基础设置' && (
              <>
                <SettingsCard
                  description="这些信息会影响首页、浏览器标题、邮件通知和多学校私有化交付时的默认展示。"
                  icon={<Building2 className="h-5 w-5" />}
                  title="平台与组织"
                >
                  <SettingRow
                    control={<TextField value="CQUPT-SRC 校园漏洞响应平台" />}
                    description="显示在登录页、管理端标题和系统通知中，建议使用学校或组织认可的正式名称。"
                    title="平台名称"
                  />
                  <SettingRow
                    control={<TextField value="重庆邮电大学" />}
                    description="用于证书、责任书、通知模板和公开核验页面。多学校部署时应配置为当前租户名称。"
                    title="学校名称"
                  />
                  <SettingRow
                    control={<TextField value="信息化办公室" />}
                    description="平台主管部门名称，会出现在漏洞响应流程、证书签发单位和公告落款中。"
                    title="主管单位"
                  />
                  <SettingRow
                    control={<TextField value="https://src.cqupt.edu.cn" />}
                    description="用于生成通知链接、证书核验地址和对外访问入口。生产环境应配置为 HTTPS 域名。"
                    title="平台访问域名"
                  />
                </SettingsCard>

                <SettingsCard
                  description="控制平台默认视觉、访客能力和不同部署形态下的开放范围。"
                  icon={<Paintbrush className="h-5 w-5" />}
                  title="外观与开放能力"
                >
                  <SettingRow
                    control={<TextField value="#2A6438" />}
                    description="系统主色将用于按钮、当前菜单、重点状态和部分图标。修改后应检查深色和浅色模式可读性。"
                    title="主题色"
                  />
                  <SettingRow
                    control={<SelectInput label="" options={['跟随系统', '浅色模式', '深色模式']} value="跟随系统" />}
                    description="新用户首次进入平台时使用的主题策略，用户仍可在个人设置中覆盖。"
                    title="默认主题"
                  />
                  <SettingRow
                    control={<SelectInput label="" options={['学校服务器', 'Docker 私有化', '本地演示']} value="学校服务器" />}
                    description="仅用于管理端展示和后续部署检查，不直接改变运行环境。"
                    title="交付模式"
                  />
                  <SettingRow
                    control={
                      <SettingToggle
                        enabled={openRegister}
                        onChange={() =>
                          confirmChange({
                            title: openRegister ? '确认关闭开放注册？' : '确认开启开放注册？',
                            description: openRegister
                              ? '关闭后，新用户将无法自行注册，只能通过管理员导入、邀请或统一认证同步进入平台。'
                              : '开启后，新用户可以进入注册流程。建议同时保留邮箱验证、滑块验证和答题准入。若当前处于正式上线阶段，请确认学校已有明确开放策略。',
                            onConfirm: () => {
                              const next = !openRegister
                              setOpenRegister(next)
                              void setRegistrationMode(next).catch(() => setOpenRegister(openRegister))
                            },
                          })
                        }
                      />
                    }
                    description="控制访客是否可以进入注册流程。该项会影响平台准入边界，变更前建议确认运营策略。"
                    title="开放注册"
                  />
                  <SettingRow
                    control={
                      <SettingToggle
                        enabled={publicCertVerify}
                        onChange={() =>
                          confirmChange({
                            title: publicCertVerify ? '确认关闭公开证书查询？' : '确认开启公开证书查询？',
                            description: publicCertVerify
                              ? '关闭后，访客将无法通过证书编号或核验码公开查询证书有效性。已签发证书仍会保留在系统内。'
                              : '开启后，访客可通过证书编号或核验码验证电子证书。请确认核验页面不会展示过多个人信息。敏感字段应保持脱敏。',
                            onConfirm: () => setPublicCertVerify((value) => !value),
                          })
                        }
                      />
                    }
                    description="控制访客是否可以公开核验证书。建议只展示证书状态、贡献类型和脱敏后的获得者信息。"
                    title="公开证书查询"
                  />
                </SettingsCard>
              </>
            )}

            {activeSection === '登录与认证' && (
              <>
                <SettingsCard
                  description="管理本地账号、统一认证码、邮箱验证码和学校统一身份认证。认证策略会直接影响平台安全边界。"
                  icon={<KeyRound className="h-5 w-5" />}
                  title="登录与注册"
                >
                  <SettingRow
                    control={
                      <SelectInput
                        label=""
                        onChange={(nextValue) =>
                          confirmChange({
                            title: '确认修改默认登录方式？',
                            description: `默认登录方式将从「${defaultLogin}」调整为「${nextValue}」。这可能影响现有用户登录路径，建议在公告中提前说明。`,
                            onConfirm: () => setDefaultLogin(nextValue),
                          })
                        }
                        options={['统一认证码 + 密码', '邮箱验证码', '学校统一身份认证 SSO', '本地账号']}
                        value={defaultLogin}
                      />
                    }
                    description="决定登录页默认展示的登录方式。学校统一身份认证上线前，建议保留本地账号或统一认证码作为兜底方案。"
                    title="默认登录方式"
                  />
                  <SettingRow
                    control={<SelectInput label="" options={['开放注册', '邀请注册', '管理员导入', '统一认证同步']} value="开放注册" />}
                    description="控制新用户来源。正式上线后，如果接入学校身份源，建议使用统一认证同步或管理员导入。"
                    title="注册方式"
                  />
                </SettingsCard>

                {!openRegister && (
                  <SettingsCard
                    description="以下是关闭开放注册后提交注册申请的用户，审核通过后账号激活，拒绝后账号禁用。"
                    icon={<UserCheck className="h-5 w-5" />}
                    title={`待审核注册申请${pendingRegistrations.length > 0 ? `（${pendingRegistrations.length}）` : ''}`}
                  >
                    {pendingRegLoading ? (
                      <p className="py-4 text-center text-sm text-slate-500">加载中...</p>
                    ) : pendingRegistrations.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        暂无待审核注册申请
                      </p>
                    ) : (
                      <div className="divide-y divide-black/5 dark:divide-white/5">
                        {pendingRegistrations.map((item) => (
                          <div className="flex items-center justify-between gap-4 py-3" key={item.id}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.name}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                {item.unifiedCode} · {item.college} · {item.identityText ?? ''}{item.studentNo ? ` · ${item.studentNo}` : ''}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{item.email}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                className="flex items-center gap-1.5 rounded-lg border border-brand-600/30 bg-brand-600/10 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-600/20 dark:border-brand-300/20 dark:text-brand-300"
                                onClick={() => void handleApproveRegistration(item.id)}
                                type="button"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                通过
                              </button>
                              <button
                                className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/20 dark:border-red-400/20 dark:text-red-400"
                                onClick={() => void handleRejectRegistration(item.id)}
                                type="button"
                              >
                                <UserX className="h-3.5 w-3.5" />
                                拒绝
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SettingsCard>
                )}

                <SettingsCard
                  description="管理本地账号、统一认证码、邮箱验证码和学校统一身份认证。认证策略会直接影响平台安全边界。"
                  icon={<KeyRound className="h-5 w-5" />}
                  title="登录验证策略"
                >
                  <SettingRow
                    control={
                      <SettingToggle
                        enabled={emailVerify}
                        onChange={() =>
                          confirmChange({
                            title: emailVerify ? '确认关闭邮箱验证？' : '确认开启邮箱验证？',
                            description: emailVerify
                              ? '关闭邮箱验证会降低注册身份确认能力。除非已经接入学校统一认证，否则不建议关闭。'
                              : '开启后，新用户注册、修改邮箱和找回密码时需要完成邮件验证码校验。请先确认 SMTP 服务可用。',
                            danger: emailVerify,
                            onConfirm: () => setEmailVerify((value) => !value),
                          })
                        }
                      />
                    }
                    description="用于注册验证、修改邮箱、找回密码和重要安全通知。"
                    title="邮箱验证"
                  />
                  <SettingRow
                    control={<SettingToggle enabled />}
                    description="降低自动化注册、批量撞库和脚本登录风险。建议在开放注册时保持开启。"
                    title="滑块验证"
                  />
                  <SettingRow
                    control={<SelectInput label="" options={['5 次失败锁定 15 分钟', '10 次失败锁定 30 分钟', '关闭锁定']} value="5 次失败锁定 15 分钟" />}
                    description="连续登录失败后的账号保护策略。管理员账号建议额外叠加后台访问 IP 限制。"
                    title="账号锁定策略"
                  />
                </SettingsCard>

                <SettingsCard
                  description="当平台接入学校身份源时，需要把学校字段映射到平台用户模型。"
                  icon={<FileText className="h-5 w-5" />}
                  title="统一认证字段映射"
                >
                  <SettingRow control={<TextField value="uid" />} description="学校统一认证系统中的唯一身份标识，不等同于学号时应明确备注。" title="统一认证码字段" />
                  <SettingRow control={<TextField value="name" />} description="用于个人中心、证书、排行榜和审核通知。" title="姓名字段" />
                  <SettingRow control={<TextField value="college" />} description="用于学院统计、排行榜筛选和人才培养数据分析。" title="学院字段" />
                  <SettingRow control={<TextField value="email" />} description="用于注册验证、状态通知和安全提醒。" title="邮箱字段" />
                </SettingsCard>
              </>
            )}

            {activeSection === 'AI 设置' && (
              <>
                <SettingsCard
                  description="AI 将参与漏洞报告解析、审核辅助、学习推荐和平台知识库问答。服务配置错误会影响多个业务页面。"
                  icon={<Bot className="h-5 w-5" />}
                  title="AI 服务接入"
                >
                  <SettingRow
                    control={
                      <SettingToggle
                        enabled={aiEnabled}
                        onChange={() =>
                          confirmChange({
                            title: aiEnabled ? '确认停用 AI 能力？' : '确认启用 AI 能力？',
                            description: aiEnabled
                              ? '停用后，漏洞报告智能解析、审核员价值预判、学习路线推荐和知识库问答都将不可用。'
                              : '启用后，平台会调用配置的模型服务。请确认 API Key、数据脱敏和调用日志策略已经配置完成。',
                            danger: aiEnabled,
                            onConfirm: () => setAiEnabled((value) => !value),
                          })
                        }
                      />
                    }
                    description="总开关。关闭后所有 AI 入口会隐藏或进入不可用状态。"
                    title="启用 AI 能力"
                  />
                  <SettingRow
                    control={
                      <SelectInput
                        label=""
                        onChange={(nextValue) =>
                          confirmChange({
                            title: '确认切换 AI 服务商？',
                            description: `AI 服务商将从「${aiProvider}」切换为「${nextValue}」。切换后需要重新验证 API 地址、密钥、模型名称和数据合规策略。`,
                            onConfirm: () => setAiProvider(nextValue),
                          })
                        }
                        options={['OpenAI 兼容接口', 'Azure OpenAI', '学校私有模型', '本地大模型']}
                        value={aiProvider}
                      />
                    }
                    description="决定平台调用哪类模型服务。涉及第三方服务时，必须确认敏感数据脱敏策略。"
                    title="AI 服务商"
                  />
                  <SettingRow control={<TextField value="https://api.example.com/v1" />} description="OpenAI 兼容接口或私有模型网关地址。建议使用 HTTPS，并限制后台访问权限。" title="API Base URL" />
                  <SettingRow control={<TextField value="gpt-4.1-mini" />} description="用于常规解析、摘要和问答的默认模型。正式部署时建议记录模型版本。" title="默认模型" />
                  <SettingRow control={<TextField value="100 次 / 用户 / 日" />} description="限制普通用户调用频率，避免滥用和费用失控。管理员审核辅助可单独设置更高额度。" title="调用额度" />
                </SettingsCard>

                <SettingsCard
                  description="这些开关决定 AI 在平台内能参与哪些业务。所有 AI 结果都应作为辅助建议，由人最终确认。"
                  icon={<BrainCircuit className="h-5 w-5" />}
                  title="AI 功能"
                >
                  {[
                    ['漏洞报告智能解析', '用户上传报告后，AI 提取标题、影响资产、漏洞类型、复现步骤和修复建议。'],
                    ['审核员价值预判', '给审核员提供初步价值评分、材料完整度判断和优先级建议。'],
                    ['学习路线推荐', '根据学生能力、提交记录和学习目标推荐资源、工具和靶场。'],
                    ['平台知识库问答', '基于平台规则、提交规范、学习资源和靶场资料进行站内问答。'],
                  ].map(([title, description]) => (
                    <SettingRow key={title} control={<SettingToggle enabled />} description={description} title={title} />
                  ))}
                </SettingsCard>

                <SettingsCard
                  description="控制 AI 能读取什么、能输出什么，以及哪些内容必须留痕。"
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="AI 安全边界"
                >
                  {[
                    ['敏感字段脱敏后发送', 'Cookie、Token、密码、手机号、邮箱、统一认证码等字段在发送给模型前进行脱敏。'],
                    ['AI 输出必须人工确认', 'AI 生成的漏洞等级、修复建议和证书建议不会自动生效，必须由审核员或管理员确认。'],
                    ['记录 AI 调用日志', '记录调用时间、功能入口、模型名称、Token 消耗和操作人，用于审计与排障。'],
                    ['禁止攻击扩展建议', '避免 AI 输出超出授权范围的扩展利用、持久化、批量扫描或数据下载建议。'],
                  ].map(([title, description]) => (
                    <SettingRow key={title} control={<SettingToggle enabled />} description={description} title={title} />
                  ))}
                </SettingsCard>

                <SettingsCard
                  description="知识库用于站内搜索、AI 问答、规则解释、学习资源推荐和靶场推荐。"
                  icon={<Upload className="h-5 w-5" />}
                  title="AI 知识库"
                >
                  {['平台规则知识库', '漏洞提交规范知识库', '学习资源知识库', '靶场资源知识库'].map((title) => (
                    <SettingRow
                      control={<span className="text-sm text-slate-500 dark:text-slate-400">2026-04-27 18:30</span>}
                      description="最近索引时间。上传新文档后需要重建索引，AI 才能读取最新内容。"
                      key={title}
                      title={title}
                    />
                  ))}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton icon={<Upload className="h-4 w-4" />} label="上传知识库文档" />
                    <ActionButton icon={<DatabaseBackup className="h-4 w-4" />} label="重建索引" />
                  </div>
                </SettingsCard>
              </>
            )}

            {activeSection === '邮箱与通知' && (
              <>
                <SettingsCard
                  description="邮件服务用于注册验证码、漏洞状态变更、审核待办、证书签发和积分兑换提醒。"
                  icon={<Mail className="h-5 w-5" />}
                  title="SMTP 邮件服务"
                >
                  <SettingRow control={<TextField value="smtp.example.edu.cn" />} description="学校或组织提供的 SMTP 服务地址。生产环境建议使用专用发件账号。" title="SMTP 地址" />
                  <SettingRow control={<TextField value="465" />} description="SSL 常用 465，TLS 常用 587，具体取决于学校邮件服务配置。" title="SMTP 端口" />
                  <SettingRow control={<TextField value="security@example.edu.cn" />} description="平台验证码和通知邮件的发件邮箱。" title="发件邮箱" />
                  <SettingRow control={<SelectInput label="" options={['SSL', 'TLS', '无']} value="SSL" />} description="建议使用 SSL 或 TLS，不建议明文发送认证信息。" title="加密方式" />
                  <div className="mt-4">
                    <ActionButton icon={<Mail className="h-4 w-4" />} label="发送测试邮件" />
                  </div>
                </SettingsCard>

                <SettingsCard
                  description="通知模板支持后续对邮件标题、站内信内容和变量占位符进行编辑。"
                  icon={<FileText className="h-5 w-5" />}
                  title="通知模板"
                >
                  {['注册验证码模板', '漏洞状态变更模板', '审核员待办模板', '证书签发模板', '积分兑换模板', '系统维护模板'].map((title) => (
                    <SettingRow
                      control={<ActionButton icon={<FileText className="h-4 w-4" />} label="编辑" />}
                      description="已配置默认模板。后续可支持变量如用户姓名、漏洞编号、审核状态和证书核验码。"
                      key={title}
                      title={title}
                    />
                  ))}
                </SettingsCard>
              </>
            )}

            {activeSection === '漏洞流程' && (
              <SettingsCard
                description="配置漏洞从提交、初审、补充、确认、修复、复测到归档的全流程规则。"
                icon={<ShieldQuestion className="h-5 w-5" />}
                title="漏洞响应流程"
              >
                <SettingRow control={<TextField value="SRC" />} description="用于生成漏洞编号，例如 SRC-2026-0008。多学校部署时可配置学校简称。" title="漏洞编号前缀" />
                <SettingRow control={<SelectInput label="" options={['标准 SRC 流程', '简化审核流程', '活动专项流程']} value="标准 SRC 流程" />} description="标准流程包含提交、初审、补充、确认、修复、复测和归档。" title="默认流程" />
                <SettingRow control={<SelectInput label="" options={['允许合并', '直接驳回', '人工确认']} value="允许合并" />} description="重复漏洞建议进入合并流程，保留首报人和补充贡献记录。" title="重复漏洞处理" />
                <SettingRow control={<TextField value="24 小时" />} description="超过时间未初审时提醒审核员和管理员。" title="初审超时提醒" />
                <SettingRow control={<TextField value="7 天" />} description="责任单位超过修复时限后自动提醒，并在管理端待办中标记。" title="修复超时提醒" />
                <SettingRow control={<SettingToggle enabled />} description="提交时必须填写授权测试范围、账号来源、测试时间和不影响业务承诺。" title="要求测试边界说明" />
                <SettingRow control={<SettingToggle enabled />} description="高危及以上漏洞进入队列后自动通知管理员和对应审核员。" title="高危自动通知" />
              </SettingsCard>
            )}

            {activeSection === '证书模板' && (
              <SettingsCard
                description="证书模板在系统设置中统一管理，证书管理页只处理签发、预览、撤销和核验业务。"
                icon={<FileBadge2 className="h-5 w-5" />}
                title="证书功能与 PDF 模板"
              >
                <SettingRow control={<SettingToggle enabled />} description="关闭后，证书管理页仍可查看历史证书，但不会进入新的签发流程。" title="启用证书功能" />
                <SettingRow control={<SelectInput label="" options={['CERT-年份-流水号', '学校简称-年份-流水号', '自定义规则']} value="CERT-年份-流水号" />} description="影响新签发证书编号，不会修改历史证书编号。" title="证书编号规则" />
                <SettingRow control={<TextField value="重庆邮电大学信息化办公室" />} description="显示在 PDF 证书落款、公开核验页面和签发记录中。" title="签发单位" />
                <SettingRow
                  control={
                    <SelectInput
                      label=""
                      onChange={(nextValue) =>
                        confirmChange({
                          title: '确认修改 PDF 生成方式？',
                          description: `PDF 生成方式将从「${pdfMode}」调整为「${nextValue}」。这会影响证书下载、存档和防篡改策略。正式上线建议使用后端生成并留存文件指纹。`,
                          onConfirm: () => setPdfMode(nextValue),
                        })
                      }
                      options={['前端生成 PDF', '后端生成 PDF', '人工上传 PDF']}
                      value={pdfMode}
                    />
                  }
                  description="前端生成适合演示，后端生成更适合正式签发、防篡改、归档和审计。"
                  title="PDF 生成方式"
                />
                <SettingRow control={<SelectInput label="" options={['默认开启', '默认关闭', '签发时选择']} value="默认开启" />} description="决定新证书是否默认支持公开核验。公开页面必须避免展示敏感个人信息。" title="公开核验策略" />
                <SettingRow control={<TextField value="https://src.cqupt.edu.cn/cert" />} description="用于生成证书二维码和公开核验链接。" title="核验二维码域名" />
                <SettingRow
                  control={
                    <div className="rounded-lg border border-black/10 bg-white/60 p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
                      {certificateTemplate ? (
                        <div className="space-y-1">
                          <p className="font-semibold">{certificateTemplate.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">版本：{certificateTemplate.version}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">格式：{certificateTemplate.templateMimeType}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">印章：{certificateTemplate.sealConfigured ? '已配置' : '未配置'}</p>
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400">当前未启用证书模板</p>
                      )}
                    </div>
                  }
                  description="签发证书时会读取当前启用模板。历史证书后续会保留签发时的模板版本与快照。"
                  title="当前启用模板"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton
                    disabled={isUploadingTemplate}
                    icon={<Upload className="h-4 w-4" />}
                    label={isUploadingTemplate ? '上传中...' : '上传证书背景'}
                    onClick={() => templateInputRef.current?.click()}
                  />
                  <ActionButton
                    disabled={isUploadingTemplate}
                    icon={<Upload className="h-4 w-4" />}
                    label="上传电子签章"
                    onClick={() => sealInputRef.current?.click()}
                  />
                  <ActionButton icon={<FileBadge2 className="h-4 w-4" />} label="测试生成 PDF" />
                  <input
                    accept="application/pdf,image/png"
                    className="hidden"
                    onChange={(event) => void handleTemplateUpload(event.target.files?.[0])}
                    ref={templateInputRef}
                    type="file"
                  />
                  <input
                    accept="image/png"
                    className="hidden"
                    onChange={(event) => void handleSealUpload(event.target.files?.[0])}
                    ref={sealInputRef}
                    type="file"
                  />
                </div>
                {certificateTemplateMessage && (
                  <p className="px-6 pb-4 pt-2 text-sm text-brand-700 dark:text-green-300">{certificateTemplateMessage}</p>
                )}
              </SettingsCard>
            )}

            {activeSection === '安全与审计' && (
              <>
                <SettingsCard
                  description="这些设置决定新用户是否可以提交漏洞，以及平台如何约束授权测试边界。"
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="准入与责任边界"
                >
                  <SettingRow control={<SettingToggle enabled />} description="新注册用户必须完成安全规范答题，达到分数要求后才能提交漏洞。" title="新用户答题准入" />
                  <SettingRow control={<SettingToggle enabled />} description="用户必须签署责任书，承诺不进行未授权扫描、爆破、数据下载、权限维持和后门植入。" title="责任书签署后提交漏洞" />
                  <SettingRow control={<SettingToggle enabled />} description="管理员、审核员和用户的关键操作都会写入审计日志。" title="管理员操作留痕" />
                  <SettingRow control={<SettingToggle enabled />} description="导出漏洞、证书、用户信息时默认隐藏手机号、邮箱、Token、Cookie 等敏感字段。" title="导出数据默认脱敏" />
                  <SettingRow control={<SettingToggle enabled />} description="附件查看、下载和预览都会记录操作人、时间、IP 和关联业务编号。" title="附件下载审计" />
                </SettingsCard>

                <SettingsCard
                  description="后台访问、会话超时和日志保留策略会影响平台运维安全。"
                  icon={<DatabaseBackup className="h-5 w-5" />}
                  title="后台安全"
                >
                  <SettingRow control={<TextField value="180 天" />} description="审计日志用于追踪敏感操作，建议生产环境保留至少 180 天。" title="审计日志保留" />
                  <SettingRow control={<TextField value="120 分钟" />} description="管理员长时间无操作后自动退出，降低共享设备风险。" title="会话超时" />
                  <SettingRow
                    control={
                      <SelectInput
                        label=""
                        onChange={(nextValue) =>
                          confirmChange({
                            title: '确认修改后台访问限制？',
                            description: `后台访问限制将从「${backendAccess}」调整为「${nextValue}」。如果配置过严，可能导致管理员无法进入后台；如果配置过松，会增加后台暴露风险。`,
                            onConfirm: () => setBackendAccess(nextValue),
                          })
                        }
                        options={['不限 IP', '白名单访问', '校园网访问']}
                        value={backendAccess}
                      />
                    }
                    description="建议正式部署时限制为校园网访问或白名单访问。"
                    title="后台访问限制"
                  />
                  <SettingRow control={<SelectInput label="" options={['允许多端', '仅保留最新会话', '管理员可配置']} value="允许多端" />} description="如平台处理较多敏感数据，可考虑限制多端同时登录。" title="多端登录策略" />
                </SettingsCard>
              </>
            )}

            {activeSection === '系统维护' && (
              <>
                <SettingsCard
                  description="用于检查学校服务器、Docker 私有化或本地部署环境的关键服务状态。"
                  icon={<ServerCog className="h-5 w-5" />}
                  title="服务状态"
                >
                  {[
                    ['部署模式', 'Docker / 学校服务器', '用于区分本地演示、Docker 私有化和学校服务器正式部署。'],
                    ['数据库', '连接正常', '用于存储用户、漏洞报告、证书、积分、学习资源和审计日志。'],
                    ['附件存储', '可写入', '用于漏洞报告、PDF、图片和知识库文件。'],
                    ['AI 服务', '可用', '模型服务和知识库索引处于可调用状态。'],
                    ['邮件服务', '待配置', 'SMTP 尚未完成正式配置，验证码和通知可能不可用。'],
                    ['当前版本', 'v0.2.10', '用于部署升级、问题定位和交付记录。'],
                  ].map(([title, value, description]) => (
                    <SettingRow control={<StatusPill label={value} />} description={description} key={title} title={title} />
                  ))}
                </SettingsCard>

                <SettingsCard
                  description="用于不同学校交付、测试环境和生产环境之间迁移平台配置。"
                  icon={<DatabaseBackup className="h-5 w-5" />}
                  title="备份与配置迁移"
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionButton icon={<DatabaseBackup className="h-4 w-4" />} label="手动备份" />
                    <ActionButton icon={<Upload className="h-4 w-4" />} label="导入系统配置" />
                    <ActionButton icon={<FileText className="h-4 w-4" />} label="导出系统配置" />
                    <ActionButton icon={<ServerCog className="h-4 w-4" />} label="清理临时文件" danger />
                  </div>
                </SettingsCard>
              </>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        state={confirmState}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          confirmState?.onConfirm()
          setConfirmState(null)
        }}
      />
    </>
  )
}

function SettingsCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <SurfacePanel className="overflow-visible p-0">
      <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
        <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
          {icon}
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="divide-y divide-black/10 dark:divide-white/10">{children}</div>
    </SurfacePanel>
  )
}

function SettingRow({
  control,
  description,
  title,
}: {
  control: ReactNode
  description: string
  title: string
}) {
  return (
    <div className="grid gap-4 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
      <div>
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  )
}

function TextField({ value }: { value: string }) {
  return (
    <input
      className="w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
      defaultValue={value}
    />
  )
}

function SettingToggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange?: () => void
}) {
  return (
    <button
      aria-pressed={enabled}
      className="flex w-full items-center justify-end rounded-lg px-1 py-1 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
      onClick={onChange}
      type="button"
    >
      <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

function ActionButton({
  danger = false,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean
  disabled?: boolean
  icon: ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
        danger
          ? 'border-red-500/20 text-red-700 hover:bg-red-500/10 dark:text-red-300'
          : 'border-black/10 text-slate-700 hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
      } disabled:cursor-not-allowed disabled:opacity-55`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}

function StatusPill({ label }: { label: string }) {
  const pending = label.includes('待')
  return (
    <span
      className={`inline-flex rounded-lg border px-3 py-2 text-sm font-medium ${
        pending
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      }`}
    >
      {label}
    </span>
  )
}

function ConfirmDialog({
  onCancel,
  onConfirm,
  state,
}: {
  onCancel: () => void
  onConfirm: () => void
  state: ConfirmState
}) {
  if (!state) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${state.danger ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{state.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{state.description}</p>
            </div>
          </div>
          <button
            aria-label="关闭确认弹窗"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            onClick={onConfirm}
            type="button"
          >
            {state.confirmLabel ?? '确认修改'}
          </button>
        </div>
      </div>
    </div>
  )
}
