import {
  AtSign,
  Bot,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Send,
  Shield,
  SlidersHorizontal,
  Star,
  X,
  XCircle,
} from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { CompleteProfileModal } from '../../components/profile/CompleteProfileModal'
import { PlatformHumanVerification } from '../../components/security/PlatformHumanVerification'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  changeEmail,
  changePassword,
  changePasswordWithOld,
  getAccountProfile,
  sendCurrentEmailCode,
  uploadAvatar,
  type AccountProfile,
} from '../../services/account'
import { type AuthUser } from '../../services/auth'
import { createHumanVerificationPayload } from '../../services/humanVerification'

type UserProfileProps = {
  onAvatarChange?: (url: string) => void
  user: AuthUser
}

type Notice = { text: string; type: 'error' | 'success' | 'warning' }

export function UserProfile({ onAvatarChange, user }: UserProfileProps) {
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarNotice, setAvatarNotice] = useState<Notice | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    setIsLoadingProfile(true)
    getAccountProfile()
      .then((result) => {
        if (active) {
          setProfile(result)
          setProfileError(null)
        }
      })
      .catch((error) => {
        if (active) setProfileError(getErrorMessage(error))
      })
      .finally(() => {
        if (active) setIsLoadingProfile(false)
      })
    return () => { active = false }
  }, [])

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarNotice({ text: '请选择图片文件', type: 'warning' })
      return
    }
    if (file.size >= 2 * 1024 * 1024) {
      setAvatarNotice({ text: '头像图片大小需小于 2MB', type: 'warning' })
      return
    }
    setAvatarUploading(true)
    setAvatarNotice(null)
    try {
      const result = await uploadAvatar(file)
      setProfile((prev) => prev ? { ...prev, account: { ...prev.account, avatarUrl: result.avatarUrl } } : prev)
      onAvatarChange?.(result.avatarUrl)
      setAvatarNotice({ text: '头像已保存', type: 'success' })
    } catch (error) {
      setAvatarNotice({ text: getErrorMessage(error), type: 'error' })
    } finally {
      setAvatarUploading(false)
    }
  }

  const account = profile?.account
  const stats = profile?.stats
  const aiQuota = profile?.aiQuota
  const responsibility = profile?.security.responsibilityAgreement
  const securityExam = profile?.security.securityExam
  const avatarUrl = account?.avatarUrl ?? null
  const displayName = account?.name ?? user.name

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="My Profile"
          title="个人中心"
          description="查看账号基础信息，维护邮箱与登录密码。敏感操作会记录操作来源并写入审计日志。"
        />
      </div>

      {profileError && <AlertMessage className="mt-4" message={profileError} variant="error" />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── 左栏：头像与基础信息 */}
        <div className="space-y-5">
          <SurfacePanel className="overflow-hidden p-0">
            <div className="flex flex-col items-center gap-3 px-6 pb-5 pt-7">
              <div className="relative">
                <button
                  className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-600/30 transition hover:ring-brand-600 focus:outline-none focus:ring-brand-600 disabled:cursor-not-allowed"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  title="点击更换头像"
                  type="button"
                >
                  {avatarUrl ? (
                    <img alt="用户头像" className="h-full w-full object-cover" src={avatarUrl} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-600 text-3xl font-semibold text-white">
                      {displayName.slice(0, 1)}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                    {avatarUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </div>
                </button>
              </div>
              <input
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="上传头像"
                className="hidden"
                onChange={handleAvatarChange}
                ref={avatarInputRef}
                type="file"
              />
              {avatarNotice && (
                <AlertMessage
                  message={avatarNotice.text}
                  onClose={() => setAvatarNotice(null)}
                  variant={avatarNotice.type}
                />
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">点击头像修改</p>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{displayName}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{account?.roleLabel ?? '学生用户'}</p>
              </div>
            </div>

            <div className="border-t border-black/10 dark:border-white/10">
              {[
                ['统一认证码', account?.unifiedCode ?? user.unifiedCode],
                ['所属学院', account?.college || '未填写'],
                ['身份信息', account?.identityText || '未填写'],
                ['授权级别', formatAuthorizationLevel(account?.authorizationLevel)],
                ['账号状态', formatUserStatus(account?.status)],
              ].map(([label, value]) => (
                <div className="flex items-center justify-between gap-4 px-6 py-3 text-sm odd:bg-black/[0.02] dark:odd:bg-white/[0.02]" key={label}>
                  <span className="text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </SurfacePanel>

          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-5 py-3.5 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <Bot className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                AI token 额度
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{getQuotaPeriodLabel(aiQuota?.quotaPeriod)}剩余</p>
                  <p className="mt-1 text-2xl font-semibold">{formatNumber(aiQuota?.remaining ?? 0)}</p>
                </div>
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <p>总额度 {formatNumber(aiQuota?.activeLimit ?? 0)}</p>
                  <p>已使用 {formatNumber(aiQuota?.usedThisPeriod ?? 0)}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width,background-color] duration-200 dark:bg-brand-300"
                  style={{ width: `${Math.min(100, Math.max(0, aiQuota?.usedPercent ?? 0))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {aiQuota?.enabled === false ? '邮宝已停用，请联系管理员。' : `下次重置：${formatDate(aiQuota?.resetAt)}`}
              </p>
            </div>
          </SurfacePanel>

          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-5 py-3.5 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <ClipboardCheck className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                基础资料
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                    account?.profileCompleted
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  }`}>
                    {account?.profileCompleted ? '已完善' : '待完善'}
                  </span>
                  <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {account?.profileCompleted ? '资料已满足漏洞提交、积分激励和证书签发需要。' : '提交漏洞前需补全学院、身份和学号信息。AI 助手可直接使用。'}
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  onClick={() => setShowProfileModal(true)}
                  type="button"
                >
                  {account?.profileCompleted ? '修改' : '完善'}
                </button>
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-5 py-3.5 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <Star className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                个人积分统计
              </div>
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-black/10 dark:divide-white/10">
              <StatCell label="总积分" value={stats?.currentPoints ?? 0} />
              <StatCell label="漏洞提交" value={stats?.submittedReports ?? 0} />
              <StatCell label="有效漏洞" value={stats?.validReports ?? 0} />
              <StatCell label="证书数量" value={stats?.certificates ?? 0} />
            </div>
          </SurfacePanel>

          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-5 py-3.5 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <Shield className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                安全准入状态
              </div>
            </div>
            <div className="divide-y divide-black/10 px-5 py-1 dark:divide-white/10">
              <AgreementRow
                detail={responsibility ? `${responsibility.version} · ${formatDate(responsibility.signedAt)}` : '提交漏洞前需签署当前版本'}
                label="CQUPT-SRC 授权测试责任书"
                signed={Boolean(responsibility)}
              />
              <AgreementRow
                detail={securityExam ? `${securityExam.score ?? '--'} 分 · ${formatDate(securityExam.submittedAt)}` : '按系统设置决定是否强制'}
                label="安全准入答题"
                signed={securityExam?.passed ?? false}
              />
            </div>
          </SurfacePanel>
        </div>

        {/* ── 右栏：账号安全设置 */}
        <div className="space-y-5">
          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
              <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
                <Mail className="h-5 w-5" />
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">邮箱绑定</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                绑定邮箱用于接收系统通知和安全验证，修改时需先验证当前邮箱。
              </p>
            </div>
            <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">当前绑定邮箱</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-950 dark:text-white">
                  {isLoadingProfile ? '加载中...' : (account?.email || '未绑定')}
                </p>
                {account?.emailVerified && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    已验证
                  </span>
                )}
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                onClick={() => setShowEmailModal(true)}
                type="button"
              >
                <Pencil className="h-4 w-4" />
                修改邮箱
              </button>
            </div>
          </SurfacePanel>

          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
              <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
                <KeyRound className="h-5 w-5" />
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">登录密码</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                通过邮箱验证码修改密码，无需输入当前密码。修改后其他设备将自动退出登录。
              </p>
            </div>
            <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">上次登录</p>
                <p className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
                  {account?.lastLoginAt ? formatDate(account.lastLoginAt) : '暂无记录'}
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                onClick={() => setShowPasswordModal(true)}
                type="button"
              >
                <Pencil className="h-4 w-4" />
                修改密码
              </button>
            </div>
          </SurfacePanel>

          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
              <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
                <SlidersHorizontal className="h-5 w-5" />
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">账号详情</h2>
              </div>
            </div>
            <div className="divide-y divide-black/10 dark:divide-white/10">
              {[
                ['统一认证码', account?.unifiedCode ?? user.unifiedCode],
                ['学号', account?.studentNo || '未填写'],
                ['年级', account?.grade || '未填写'],
                ['所属学院', account?.college || '未填写'],
                ['账号角色', account?.roleLabel ?? '学生用户'],
                ['授权级别', formatAuthorizationLevel(account?.authorizationLevel)],
                ['注册时间', account?.createdAt ? formatDate(account.createdAt) : '—'],
                ['上次登录', account?.lastLoginAt ? formatDate(account.lastLoginAt) : '—'],
              ].map(([label, value]) => (
                <div className="grid gap-4 px-6 py-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" key={label}>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="min-w-0 text-right text-sm font-medium text-slate-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </SurfacePanel>

          <div className="flex items-start gap-3 rounded-lg border border-black/10 px-4 py-3.5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600/70 dark:text-brand-300/70" />
            {isLoadingProfile ? '正在同步账号信息...' : '邮箱变更、密码修改等操作会记录操作时间、来源 IP、用户代理和操作结果，便于安全审计。'}
          </div>
        </div>
      </div>

      {showEmailModal && (
        <ChangeEmailModal
          currentEmail={account?.email ?? ''}
          onClose={() => setShowEmailModal(false)}
          onSuccess={(newEmail) => {
            setProfile((prev) =>
              prev ? { ...prev, account: { ...prev.account, email: newEmail } } : prev,
            )
            setShowEmailModal(false)
          }}
        />
      )}

      {showPasswordModal && (
        <ChangePasswordModal
          currentEmail={account?.email ?? ''}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {showProfileModal && account && (
        <CompleteProfileModal
          initialProfile={account}
          onClose={() => setShowProfileModal(false)}
          onSaved={(next) => {
            setProfile((prev) =>
              prev ? { ...prev, account: { ...prev.account, ...next } } : prev,
            )
            setShowProfileModal(false)
          }}
        />
      )}
    </section>
  )
}

// ── 修改邮箱弹窗
// 流程：发送验证码到当前邮箱 → 输入验证码 + 新邮箱 → 点击确认修改
function ChangeEmailModal({
  currentEmail,
  onClose,
  onSuccess,
}: {
  currentEmail: string
  onClose: () => void
  onSuccess: (newEmail: string) => void
}) {
  const [step, setStep] = useState<'send' | 'verify'>('send')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendHumanPayload, setSendHumanPayload] = useState('')
  const [submitHumanPayload, setSubmitHumanPayload] = useState('')
  const [humanResetKey, setHumanResetKey] = useState(0)

  const sendCode = async () => {
    if (!sendHumanPayload) {
      setNotice({ text: '请先完成安全校验', type: 'warning' })
      return
    }
    setSending(true)
    setNotice(null)
    try {
      const result = await sendCurrentEmailCode('CHANGE_EMAIL', createHumanVerificationPayload(sendHumanPayload).humanVerification)
      setNotice({
        text: result.devCode ? `验证码已发送。开发预览码：${result.devCode}` : result.message,
        type: 'success',
      })
      setStep('verify')
      setSendHumanPayload('')
      setSubmitHumanPayload('')
      setHumanResetKey((value) => value + 1)
    } catch (error) {
      setNotice({ text: getErrorMessage(error), type: 'error' })
      setSendHumanPayload('')
      setHumanResetKey((value) => value + 1)
    } finally {
      setSending(false)
    }
  }

  const confirmChange = async () => {
    if (!/^\d{6}$/.test(code)) {
      setNotice({ text: '请输入 6 位验证码', type: 'warning' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setNotice({ text: '请输入正确的邮箱格式', type: 'warning' })
      return
    }
    if (!submitHumanPayload) {
      setNotice({ text: '请完成修改邮箱前的安全校验', type: 'warning' })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const result = await changeEmail({
        code,
        newEmail,
        ...createHumanVerificationPayload(submitHumanPayload),
      })
      onSuccess(result.email)
    } catch (error) {
      setNotice({ text: getErrorMessage(error), type: 'error' })
      setSubmitHumanPayload('')
      setHumanResetKey((value) => value + 1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="修改邮箱">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-4 py-3 ">
          <p className="text-xs text-slate-400 dark:text-slate-500">当前邮箱</p>
          <p className="mt-0.5 font-mono text-sm font-medium text-slate-950 dark:text-white">{currentEmail || '未绑定'}</p>
        </div>

        {step === 'send' ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              点击下方按钮，将向当前邮箱发送一条验证码，用于确认身份后修改新邮箱。
            </p>
            <PlatformHumanVerification
              compact
              onChange={setSendHumanPayload}
              onError={(text) => setNotice({ text, type: 'error' })}
              purpose="CHANGE_EMAIL_CODE"
              resetKey={`email-code-${humanResetKey}`}
            />
            {notice && <NoticeBar notice={notice} />}
            <div className="flex justify-end gap-3 pt-1">
              <button className="rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10" onClick={onClose} type="button">取消</button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-55"
                disabled={sending}
                onClick={sendCode}
                type="button"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? '发送中...' : '发送验证码'}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">邮箱验证码（发至当前邮箱）</span>
              <input
                autoFocus
                className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 "
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="请输入 6 位验证码"
                value={code}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">新邮箱地址</span>
              <div className="group relative">
                <AtSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
                <input
                  className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmChange()}
                  placeholder="name@example.com"
                  type="email"
                  value={newEmail}
                />
              </div>
            </label>
            <PlatformHumanVerification
              compact
              onChange={setSubmitHumanPayload}
              onError={(text) => setNotice({ text, type: 'error' })}
              purpose="CHANGE_EMAIL_SUBMIT"
              resetKey={`email-submit-${humanResetKey}`}
            />
            {notice && <NoticeBar notice={notice} />}
            <div className="flex justify-end gap-3 pt-1">
              <button
                className="rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
                onClick={() => { setStep('send'); setCode(''); setNotice(null) }}
                type="button"
              >
                重新发送
              </button>
              <button
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-55"
                disabled={saving}
                onClick={confirmChange}
                type="button"
              >
                {saving ? '保存中...' : '修改邮箱'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── 修改密码弹窗
// 两种方式：旧密码验证 / 邮箱验证码验证
function ChangePasswordModal({
  currentEmail,
  onClose,
}: {
  currentEmail: string
  onClose: () => void
}) {
  const [method, setMethod] = useState<'old-password' | 'email-code'>('old-password')
  const [codeSent, setCodeSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [code, setCode] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sendHumanPayload, setSendHumanPayload] = useState('')
  const [submitHumanPayload, setSubmitHumanPayload] = useState('')
  const [humanResetKey, setHumanResetKey] = useState(0)

  const sendCode = async () => {
    if (!sendHumanPayload) {
      setNotice({ text: '请先完成安全校验', type: 'warning' })
      return
    }
    setSending(true)
    setNotice(null)
    try {
      const result = await sendCurrentEmailCode('CHANGE_PASSWORD', createHumanVerificationPayload(sendHumanPayload).humanVerification)
      setNotice({
        text: result.devCode ? `验证码已发送。开发预览码：${result.devCode}` : result.message,
        type: 'success',
      })
      setCodeSent(true)
      setSendHumanPayload('')
      setSubmitHumanPayload('')
      setHumanResetKey((value) => value + 1)
    } catch (error) {
      setNotice({ text: getErrorMessage(error), type: 'error' })
      setSendHumanPayload('')
      setHumanResetKey((value) => value + 1)
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async () => {
    if (method === 'old-password') {
      if (!oldPassword) {
        setNotice({ text: '请输入旧密码', type: 'warning' })
        return
      }
    } else {
      if (!/^\d{6}$/.test(code)) {
        setNotice({ text: '请输入 6 位验证码', type: 'warning' })
        return
      }
    }
    if (newPassword.length < 8) {
      setNotice({ text: '新密码至少需要 8 位', type: 'warning' })
      return
    }
    if (newPassword !== confirmPassword) {
      setNotice({ text: '两次输入的新密码不一致', type: 'warning' })
      return
    }
    if (method === 'old-password' && oldPassword === newPassword) {
      setNotice({ text: '新密码不能与旧密码相同', type: 'warning' })
      return
    }
    if (!submitHumanPayload) {
      setNotice({ text: '请完成修改密码前的安全校验', type: 'warning' })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const result = method === 'old-password'
        ? await changePasswordWithOld({
            oldPassword,
            newPassword,
            ...createHumanVerificationPayload(submitHumanPayload),
          })
        : await changePassword({
            code,
            newPassword,
            ...createHumanVerificationPayload(submitHumanPayload),
          })
      setNotice({ text: result.message, type: 'success' })
      setSuccess(true)
    } catch (error) {
      setNotice({ text: getErrorMessage(error), type: 'error' })
      setSubmitHumanPayload('')
      setHumanResetKey((value) => value + 1)
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <Modal onClose={onClose} title="修改密码">
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">密码已成功更新。其他设备将在下次请求时退出登录。</p>
          <button className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700" onClick={onClose} type="button">完成</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} title="修改密码">
      <div className="space-y-4">
        {/* 验证方式切换 */}
        <div className="grid grid-cols-2 border-b border-black/10 text-sm font-medium dark:border-white/10">
          <button
            className={`border-b-2 pb-3 transition ${
              method === 'old-password'
                ? 'border-brand-600 text-brand-700 dark:border-brand-200 dark:text-brand-100'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/75'
            }`}
            onClick={() => {
              setMethod('old-password')
              setNotice(null)
              setSendHumanPayload('')
              setSubmitHumanPayload('')
              setHumanResetKey((value) => value + 1)
            }}
            type="button"
          >
            旧密码验证
          </button>
          <button
            className={`border-b-2 pb-3 transition ${
              method === 'email-code'
                ? 'border-brand-600 text-brand-700 dark:border-brand-200 dark:text-brand-100'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/75'
            }`}
            onClick={() => {
              setMethod('email-code')
              setNotice(null)
              setSendHumanPayload('')
              setSubmitHumanPayload('')
              setHumanResetKey((value) => value + 1)
            }}
            type="button"
          >
            邮箱验证
          </button>
        </div>

        {method === 'old-password' ? (
          <>
            <div className="group relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
              <input
                autoFocus
                className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-11 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="输入当前密码"
                type={showOldPassword ? 'text' : 'password'}
                value={oldPassword}
              />
              <button
                aria-label={showOldPassword ? '隐藏密码' : '显示密码'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60"
                onClick={() => setShowOldPassword((v) => !v)}
                type="button"
              >
                {showOldPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <PlatformHumanVerification
              compact
              onChange={setSubmitHumanPayload}
              onError={(text) => setNotice({ text, type: 'error' })}
              purpose="CHANGE_PASSWORD"
              resetKey={`old-password-${humanResetKey}`}
            />
          </>
        ) : (
          <>
            <div className="rounded-lg bg-slate-50 px-4 py-3 ">
              <p className="text-xs text-slate-400 dark:text-slate-500">验证邮箱</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-slate-950 dark:text-white">{currentEmail || '未绑定'}</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">邮箱验证码</label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  disabled:opacity-50"
                  disabled={!codeSent}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={codeSent ? '请输入 6 位验证码' : '请先点击发送验证码'}
                  value={code}
                />
                <button
                  className="shrink-0 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  disabled={sending || codeSent}
                  onClick={sendCode}
                  type="button"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : codeSent ? '已发送' : '发送验证码'}
                </button>
              </div>
            </div>
            <PlatformHumanVerification
              compact
              onChange={codeSent ? setSubmitHumanPayload : setSendHumanPayload}
              onError={(text) => setNotice({ text, type: 'error' })}
              purpose="CHANGE_PASSWORD"
              resetKey={`password-email-${codeSent ? 'submit' : 'send'}-${humanResetKey}`}
            />
          </>
        )}

        <div className="group relative">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
          <input
            className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-11 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新密码（至少 8 位，字母+数字）"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
          />
          <button
            aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60"
            onClick={() => setShowNewPassword((v) => !v)}
            type="button"
          >
            {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="group relative">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
          <input
            className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="确认新密码"
            type="password"
            value={confirmPassword}
          />
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">密码修改操作将记录至安全审计日志。</p>
        {notice && <NoticeBar notice={notice} />}
        <div className="flex justify-end gap-3 pt-1">
          <button className="rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10" onClick={onClose} type="button">取消</button>
          <button
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-55"
            disabled={saving || (method === 'email-code' && !codeSent)}
            onClick={handleSubmit}
            type="button"
          >
            {saving ? '更新中...' : '确定修改'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  useEffect(() => {
    document.documentElement.classList.add('auth-modal-open')
    return () => document.documentElement.classList.remove('auth-modal-open')
  }, [])

  return (
    <div className="fixed inset-0 z-[100] isolate flex items-center justify-center p-4">
      <button
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/70"
        onClick={onClose}
        type="button"
      />
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-[420px] transform-gpu rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-8 text-slate-950 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:text-white"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <button
          aria-label="关闭弹窗"
          className="absolute right-4 top-4 rounded-md p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="mb-6 text-center text-lg font-semibold">{title}</h3>
        {children}
      </motion.section>
    </div>
  )
}

function NoticeBar({ notice }: { notice: Notice }) {
  return <AlertMessage message={notice.text} variant={notice.type} />
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-4 text-center">
      <p className="text-2xl font-bold text-brand-700 dark:text-brand-300">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

function AgreementRow({ detail, label, signed }: { detail: string; label: string; signed: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 text-sm">
      <span>
        <span className="block text-slate-600 dark:text-slate-400">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{detail}</span>
      </span>
      {signed ? (
        <span className="flex shrink-0 items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> 已完成
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-slate-400">
          <XCircle className="h-4 w-4" /> 未完成
        </span>
      )}
    </div>
  )
}

function formatAuthorizationLevel(level: AccountProfile['account']['authorizationLevel'] | undefined) {
  if (level === 'STAFF') return '教职工专项'
  if (level === 'TRUSTED') return '可信成员'
  return '基础授权'
}

function formatUserStatus(status: string | undefined) {
  if (status === 'ACTIVE') return '正常'
  if (status === 'PENDING') return '待准入'
  if (status === 'DISABLED') return '已禁用'
  if (status === 'LOCKED') return '已锁定'
  return '正常'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function getQuotaPeriodLabel(period: 'DAY' | 'WEEK' | 'MONTH' | undefined) {
  if (period === 'DAY') return '今日'
  if (period === 'WEEK') return '本周'
  return '本月'
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return '操作失败，请稍后重试'
}
