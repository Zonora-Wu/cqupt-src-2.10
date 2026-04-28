import { AtSign, CalendarClock, Camera, CheckCircle2, KeyRound, Mail, Star, UserRound, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { type AuthUser, isValidEmail } from '../../services/auth'

type UserProfileProps = {
  user: AuthUser
}

export function UserProfile({ user }: UserProfileProps) {
  const [email, setEmail] = useState(user.email ?? '')
  const [emailDraft, setEmailDraft] = useState(user.email ?? '')
  const [emailMessage, setEmailMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
  })
  const [passwordMessage, setPasswordMessage] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) return // 2MB limit
    const url = URL.createObjectURL(file)
    setAvatarUrl(url)
  }

  const updateEmail = () => {
    if (!isValidEmail(emailDraft)) {
      setEmailMessage('请输入正确的邮箱地址')
      return
    }

    setEmail(emailDraft)
    setEmailMessage('邮箱已更新，正式环境中需要完成邮箱验证码确认。')
  }

  const updatePassword = () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessage('请完整填写当前密码、新密码和确认密码')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage('新密码至少需要 8 位')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('两次输入的新密码不一致')
      return
    }

    setPasswordForm({ confirmPassword: '', currentPassword: '', newPassword: '' })
    setPasswordMessage('密码修改申请已提交，正式环境中会重新校验当前密码。')
  }

  return (
    <PageSection size="md">
      <PageHeader
        eyebrow="Profile"
        eyebrowIcon={<UserRound className="h-3.5 w-3.5" />}
        title="个人中心"
        description="查看账号基础信息，维护邮筱与登录密码。正式环境中敏感操作需要二次验证并写入审计日志。"
      />

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
              <InfoRow label="统一认证码" value={user.unifiedCode} />
              <InfoRow label="绑定邮箱" value={email || '未绑定'} />
              <InfoRow label="账号角色" value="学生用户" />
              <InfoRow label="账号状态" value="正常" />
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
                  <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-green-300">0</p>
                </div>
                <div className="rounded-lg bg-brand-50 p-3 dark:bg-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">漏洞提交数</p>
                  <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-green-300">0</p>
                </div>
              </div>
            </div>

            {/* 责任书签署情况 */}
            <div className="mt-5 border-t border-black/10 pt-5 dark:border-white/10">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">责任书签署情况</p>
              <div className="mt-3 space-y-2">
                <AgreementRow label="平台使用责任书" signed={false} />
                <AgreementRow label="漏洞披露保密协议" signed={false} />
                <AgreementRow label="网络安全承诺书" signed={false} />
              </div>
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                提交漏洞前需完成全部责任书签署
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

            {emailMessage && <p className="mt-3 text-sm text-brand-700 dark:text-green-300">{emailMessage}</p>}

            <button
              className="mt-5 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
              onClick={updateEmail}
              type="button"
            >
              保存邮箱
            </button>
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

            {passwordMessage && <p className="mt-3 text-sm text-brand-700 dark:text-green-300">{passwordMessage}</p>}

            <button
              className="mt-5 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
              onClick={updatePassword}
              type="button"
            >
              更新密码
            </button>
          </SurfacePanel>

          <SurfacePanel className="p-5">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-green-300" />
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                账号信息、邮箱变更、密码修改等操作后续需要记录操作时间、来源 IP、用户代理和操作结果，便于安全审计。
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

function AgreementRow({ label, signed }: { label: string; signed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      {signed ? (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          已签署
        </span>
      ) : (
        <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <XCircle className="h-4 w-4" />
          未签署
        </span>
      )}
    </div>
  )
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
