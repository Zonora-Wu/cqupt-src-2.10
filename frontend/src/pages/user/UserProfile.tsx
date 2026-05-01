import { AtSign, CalendarClock, Camera, CheckCircle2, KeyRound, Mail, Star, UserRound, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  changeEmail,
  changePassword,
  getAccountProfile,
  sendChangeEmailCode,
  type AccountProfile,
} from '../../services/account'
import { type AuthUser, isValidEmail } from '../../services/auth'

type UserProfileProps = {
  user: AuthUser
}

type NoticeState = {
  text: string
  type: 'error' | 'info' | 'success' | 'warning'
}

export function UserProfile({ user }: UserProfileProps) {
  const [email, setEmail] = useState(user.email ?? '')
  const [emailDraft, setEmailDraft] = useState(user.email ?? '')
  const [emailCode, setEmailCode] = useState('')
  const [emailMessage, setEmailMessage] = useState<NoticeState | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
  })
  const [passwordMessage, setPasswordMessage] = useState<NoticeState | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [profileError, setProfileError] = useState<NoticeState | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false)
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      try {
        setIsLoadingProfile(true)
        const result = await getAccountProfile()
        if (!active) return
        setProfile(result)
        setEmail(result.account.email)
        setEmailDraft(result.account.email)
        setProfileError(null)
      } catch (error) {
        if (active) {
          setProfileError({ text: getErrorMessage(error), type: 'error' })
        }
      } finally {
        if (active) {
          setIsLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [])

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) return // 2MB limit
    const url = URL.createObjectURL(file)
    setAvatarUrl(url)
  }

  const requestEmailCode = async () => {
    if (!isValidEmail(emailDraft)) {
      setEmailMessage({ text: '请输入正确的邮箱地址', type: 'warning' })
      return
    }

    try {
      setIsSendingEmailCode(true)
      const result = await sendChangeEmailCode(emailDraft)
      setEmailMessage({
        text: result.devCode ? `${result.message}，开发验证码：${result.devCode}` : result.message,
        type: 'success',
      })
    } catch (error) {
      setEmailMessage({ text: getErrorMessage(error), type: 'error' })
    } finally {
      setIsSendingEmailCode(false)
    }
  }

  const updateEmail = async () => {
    if (!isValidEmail(emailDraft)) {
      setEmailMessage({ text: '请输入正确的邮箱地址', type: 'warning' })
      return
    }

    if (!/^\d{6}$/.test(emailCode)) {
      setEmailMessage({ text: '请输入 6 位邮箱验证码', type: 'warning' })
      return
    }

    try {
      setIsChangingEmail(true)
      const result = await changeEmail({ code: emailCode, newEmail: emailDraft })
      setEmail(result.email)
      setEmailCode('')
      setEmailMessage({ text: result.message, type: 'success' })
      const nextProfile = await getAccountProfile()
      setProfile(nextProfile)
    } catch (error) {
      setEmailMessage({ text: getErrorMessage(error), type: 'error' })
    } finally {
      setIsChangingEmail(false)
    }
  }

  const updatePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessage({ text: '请完整填写当前密码、新密码和确认密码', type: 'warning' })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ text: '新密码至少需要 8 位', type: 'warning' })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ text: '两次输入的新密码不一致', type: 'warning' })
      return
    }

    try {
      setIsChangingPassword(true)
      const result = await changePassword({
        newPassword: passwordForm.newPassword,
        oldPassword: passwordForm.currentPassword,
      })
      setPasswordForm({ confirmPassword: '', currentPassword: '', newPassword: '' })
      setPasswordMessage({ text: result.message, type: 'success' })
    } catch (error) {
      setPasswordMessage({ text: getErrorMessage(error), type: 'error' })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const account = profile?.account
  const stats = profile?.stats
  const responsibility = profile?.security.responsibilityAgreement
  const securityExam = profile?.security.securityExam

  return (
    <PageSection size="md">
      <PageHeader
        eyebrow="Profile"
        eyebrowIcon={<UserRound className="h-3.5 w-3.5" />}
        title="个人中心"
        description="查看账号基础信息，维护邮箱与登录密码。敏感操作会记录操作来源并写入审计日志。"
      />

      {profileError && (
        <AlertMessage className="mt-5" message={profileError.text} onClose={() => setProfileError(null)} title="账号信息加载失败" variant={profileError.type} />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid gap-6">
          <SurfacePanel className="p-6">
            {/* 头像区域 */}
            <div className="flex flex-col items-center gap-3">
              <button
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-600/30 transition hover:ring-brand-600 focus:outline-none focus:ring-brand-600"
                onClick={() => avatarInputRef.current?.click()}
                title="点击更换头像"
                type="button"
              >
                {avatarUrl ? (
                  <img alt="用户头像" className="h-full w-full object-cover" src={avatarUrl} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-600 text-2xl font-semibold text-white">
                    {user.name.slice(0, 1)}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </button>
              <input
                accept="image/*"
                aria-label="上传头像"
                className="hidden"
                onChange={handleAvatarChange}
                ref={avatarInputRef}
                type="file"
              />
              <div className="text-center">
                <h2 className="text-xl font-semibold">{user.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">学生用户</p>
              </div>
            </div>

            {/* 基础信息 */}
            <div className="mt-6 space-y-3 border-t border-black/10 pt-5 dark:border-white/10">
              <InfoRow label="统一认证码" value={account?.unifiedCode ?? user.unifiedCode} />
              <InfoRow label="绑定邮箱" value={email || '未绑定'} />
              <InfoRow label="所属学院" value={account?.college || '未填写'} />
              <InfoRow label="身份信息" value={account?.identityText || '未填写'} />
              <InfoRow label="授权级别" value={formatAuthorizationLevel(account?.authorizationLevel)} />
              <InfoRow label="账号角色" value={account?.roleLabel ?? '学生用户'} />
              <InfoRow label="账号状态" value={formatUserStatus(account?.status)} />
            </div>

            {/* 积分信息 */}
            <div className="mt-5 border-t border-black/10 pt-5 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Star className="h-4 w-4 text-brand-600 dark:text-green-300" />
                个人积分
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-brand-50 p-3 dark:bg-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">总积分</p>
                  <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-green-300">{stats?.currentPoints ?? 0}</p>
                </div>
                <div className="rounded-lg bg-brand-50 p-3 dark:bg-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">漏洞提交数</p>
                  <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-green-300">{stats?.submittedReports ?? 0}</p>
                </div>
                <div className="rounded-lg bg-brand-50 p-3 dark:bg-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">有效漏洞</p>
                  <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-green-300">{stats?.validReports ?? 0}</p>
                </div>
                <div className="rounded-lg bg-brand-50 p-3 dark:bg-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">证书数量</p>
                  <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-green-300">{stats?.certificates ?? 0}</p>
                </div>
              </div>
            </div>

            {/* 责任书签署情况 */}
            <div className="mt-5 border-t border-black/10 pt-5 dark:border-white/10">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">责任书签署情况</p>
              <div className="mt-3 space-y-2">
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
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                提交漏洞前需满足邮箱验证、责任书签署和系统要求的安全答题。
              </p>
            </div>
          </SurfacePanel>
        </div>

        <div className="grid gap-6">
          <SurfacePanel className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">邮箱设置</p>
                <h2 className="mt-1 text-xl font-semibold">修改邮箱</h2>
              </div>
              <Mail className="h-7 w-7 text-brand-700 dark:text-green-300" />
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">新邮箱地址</span>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm transition focus-within:border-brand-600/60 focus-within:ring-1 focus-within:ring-brand-600/40 dark:border-white/10 dark:bg-white/5">
                <AtSign className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
                  onChange={(event) => setEmailDraft(event.target.value)}
                  placeholder="name@example.edu.cn"
                  type="email"
                  value={emailDraft}
                />
              </div>
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">邮箱验证码</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                maxLength={6}
                onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="请输入 6 位验证码"
                value={emailCode}
              />
            </label>

            {emailMessage && (
              <AlertMessage
                className="mt-4"
                message={emailMessage.text}
                onClose={() => setEmailMessage(null)}
                variant={emailMessage.type}
              />
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                disabled={isSendingEmailCode}
                onClick={requestEmailCode}
                type="button"
              >
                {isSendingEmailCode ? '发送中...' : '发送验证码'}
              </button>
              <button
                className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={isChangingEmail}
                onClick={updateEmail}
                type="button"
              >
                {isChangingEmail ? '保存中...' : '确认修改'}
              </button>
            </div>
          </SurfacePanel>

          <SurfacePanel className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">账号安全</p>
                <h2 className="mt-1 text-xl font-semibold">修改密码</h2>
              </div>
              <KeyRound className="h-7 w-7 text-brand-700 dark:text-green-300" />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <PasswordInput
                label="当前密码"
                onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
                value={passwordForm.currentPassword}
              />
              <PasswordInput
                label="新密码"
                onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
                value={passwordForm.newPassword}
              />
              <PasswordInput
                label="确认新密码"
                onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
                value={passwordForm.confirmPassword}
              />
            </div>

            {passwordMessage && (
              <AlertMessage
                className="mt-4"
                message={passwordMessage.text}
                onClose={() => setPasswordMessage(null)}
                variant={passwordMessage.type}
              />
            )}

            <button
              className="mt-5 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isChangingPassword}
              onClick={updatePassword}
              type="button"
            >
              {isChangingPassword ? '更新中...' : '更新密码'}
            </button>
          </SurfacePanel>

          <SurfacePanel className="p-5">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-green-300" />
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                {isLoadingProfile ? '正在同步账号中心信息...' : '账号信息、邮箱变更、密码修改等操作会记录操作时间、来源 IP、用户代理和操作结果，便于安全审计。'}
              </p>
            </div>
          </SurfacePanel>
        </div>
      </div>
    </PageSection>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function AgreementRow({ detail, label, signed }: { detail: string; label: string; signed: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span>
        <span className="block text-slate-600 dark:text-slate-400">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{detail}</span>
      </span>
      {signed ? (
        <span className="flex shrink-0 items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          已签署
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-slate-400 dark:text-slate-500">
          <XCircle className="h-4 w-4" />
          未完成
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
  if (!value) return '--'
  return new Date(value).toLocaleDateString('zh-CN')
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return '操作失败，请稍后重试'
}

function PasswordInput({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
        onChange={(event) => onChange(event.target.value)}
        type="password"
        value={value}
      />
    </label>
  )
}
