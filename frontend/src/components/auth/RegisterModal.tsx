import {
  ArrowRight,
  Badge,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  LockKeyhole,
  Mail,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { AlertMessage } from '../ui/AlertMessage'
import { SlideVerify } from '../ui/SlideVerify'
import { isValidEmail, registerAccount, sendRegisterEmailCode, type AuthUser, type RegisterResult } from '../../services/auth'

type RegisterModalProps = {
  onClose: () => void
  onRegisterSuccess?: (user: AuthUser) => void
  onSwitchToLogin: () => void
}

const identityTypes = ['本科生', '研究生', '教师', '信息化办老师', '社团/工作室成员']

export function RegisterModal({ onClose, onRegisterSuccess, onSwitchToLogin }: RegisterModalProps) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pendingApproval, setPendingApproval] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [emailCodeSentTo, setEmailCodeSentTo] = useState('')
  const [form, setForm] = useState({
    code: '',
    college: '',
    email: '',
    grade: '',
    identityText: '',
    name: '',
    password: '',
    passwordConfirm: '',
    studentNo: '',
    unifiedCode: '',
  })
  const normalizedEmail = form.email.trim().toLowerCase()
  const emailCodeIsActive = normalizedEmail === emailCodeSentTo && countdown > 0
  const shouldShowSlider = !emailCodeIsActive

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'email' && value.trim().toLowerCase() !== emailCodeSentTo) {
      setEmailCodeSentTo('')
    }
  }

  useEffect(() => {
    document.documentElement.classList.add('auth-modal-open')
    return () => document.documentElement.classList.remove('auth-modal-open')
  }, [])

  useEffect(() => {
    if (countdown <= 0) return

    const timer = window.setTimeout(() => {
      setCountdown((value) => value - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [countdown])

  const handleSendCode = async () => {
    if (countdown > 0 || sendingCode) return

    setError('')
    setMessage('')

    if (!isValidEmail(form.email)) {
      setError('请输入正确的邮箱地址')
      return
    }

    if (!captchaToken) {
      setError('请先完成滑块验证，再获取邮箱验证码')
      return
    }

    setSendingCode(true)
    try {
      const result = await sendRegisterEmailCode(form.email, captchaToken)
      setCountdown(60)
      setEmailCodeSentTo(normalizedEmail)
      setCaptchaToken('')
      setCaptchaResetKey((value) => value + 1)
      setMessage(result.devCode ? `${result.message}，开发验证码：${result.devCode}` : result.message)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '验证码发送失败')
      setCaptchaToken('')
      setCaptchaResetKey((value) => value + 1)
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (normalizedEmail !== emailCodeSentTo) {
      setError('请先获取当前邮箱的验证码')
      return
    }

    if (!/^\d{6}$/.test(form.code)) {
      setError('请输入 6 位邮箱验证码')
      return
    }

    if (!form.password || form.password.length < 8) {
      setError('密码至少需要 8 位')
      return
    }

    if (form.password !== form.passwordConfirm) {
      setError('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    try {
      const result: RegisterResult = await registerAccount(form)
      if (result.pending === true) {
        setPendingApproval(true)
        setMessage(result.message)
      } else {
        onRegisterSuccess?.(result.session.user)
        if (!onRegisterSuccess) {
          onSwitchToLogin()
        }
      }
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : '注册失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] isolate flex items-center justify-center px-4 py-8">
      <button
        aria-label="关闭注册弹窗"
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/70"
        onClick={onClose}
        type="button"
      />
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative max-h-[calc(100vh-4rem)] w-full max-w-[500px] transform-gpu overflow-y-auto rounded-lg border border-black/10 bg-white/95 p-8 text-slate-950 shadow-2xl backdrop-blur-xl [scrollbar-width:none] dark:border-white/10 dark:bg-[#111411]/95 dark:text-white [&::-webkit-scrollbar]:hidden"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <button
          aria-label="关闭注册弹窗"
          className="absolute right-4 top-4 rounded-md p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="mb-7 flex flex-col items-center text-center">
          <img
            alt="CQUPT-SRC Logo"
            className="mb-3 h-32 w-auto object-contain opacity-95 dark:hidden"
            src="/assets/logos/CQUPT_02_logo.png"
          />
          <img
            alt="CQUPT-SRC Logo"
            className="mb-3 hidden h-24 w-auto object-contain opacity-95 dark:block"
            src="/assets/logos/CQUPT_02_logo_dark.png"
          />
          <p className="mt-1 text-sm text-slate-500 dark:text-white/50">CQUPT-SRC 校园漏洞响应平台</p>
        </header>

        {pendingApproval ? (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <ShieldCheck className="h-12 w-12 text-brand-600 dark:text-green-400" />
            <div>
              <p className="text-base font-semibold">注册申请已提交</p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/50">
                {message || '管理员将尽快审核你的注册信息，审核通过后即可使用统一认证码登录。'}
              </p>
            </div>
            <button
              className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              onClick={onSwitchToLogin}
              type="button"
            >
              返回登录
            </button>
          </div>
        ) : (
          <>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input icon={<User />} onChange={(value) => updateField('name', value)} placeholder="姓名" required type="text" value={form.name} />
              <Input icon={<Badge />} onChange={(value) => updateField('unifiedCode', value)} placeholder="统一认证码" required type="text" value={form.unifiedCode} />
              <Input icon={<GraduationCap />} onChange={(value) => updateField('college', value)} placeholder="学院" required type="text" value={form.college} />

              <label className="relative block">
                <GraduationCap className="absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-white/35" />
                <select
                  className="w-full appearance-none rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-3 text-sm text-slate-950 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-brand-300/60 dark:focus:ring-brand-300/50"
                  onChange={(event) => updateField('identityText', event.target.value)}
                  required
                  value={form.identityText}
                >
                  <option disabled value="">
                    身份类型
                  </option>
                  {identityTypes.map((item) => (
                    <option className="bg-white text-slate-950 dark:bg-[#111411] dark:text-white" key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input icon={<Badge />} onChange={(value) => updateField('studentNo', value)} placeholder="学号（教师可留空）" type="text" value={form.studentNo} />
                <Input icon={<GraduationCap />} onChange={(value) => updateField('grade', value)} placeholder="年级（教师可留空）" type="text" value={form.grade} />
              </div>

              <Input icon={<Mail />} onChange={(value) => updateField('email', value)} placeholder="校内邮箱" required type="email" value={form.email} />

              <div className="flex gap-3">
                <Input className="flex-1" icon={<Mail />} onChange={(value) => updateField('code', value)} placeholder="邮箱验证码" required type="text" value={form.code} />
                <button
                  className="rounded-lg border border-black/10 bg-white/70 px-4 text-sm font-medium text-slate-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  disabled={countdown > 0 || sendingCode}
                  onClick={() => void handleSendCode()}
                  type="button"
                >
                  {sendingCode ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>

              <div>
                <div className="group relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-white/35" />
                  <input
                    className="w-full rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-11 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-300/60 dark:focus:ring-brand-300/50"
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="密码"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                  />
                  <button
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/35 dark:hover:text-white/60"
                    onClick={() => setShowPassword((v) => !v)}
                    type="button"
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-1 pl-1 text-xs leading-5 text-slate-500 dark:text-white/45">
                  长度至少8位，需包含数字、字母及符号中至少两种组合
                </p>
              </div>

              <Input icon={<LockKeyhole />} onChange={(value) => updateField('passwordConfirm', value)} placeholder="确认密码" required type="password" value={form.passwordConfirm} />

              {shouldShowSlider ? (
                <SlideVerify
                  mode="server"
                  onError={setError}
                  onTokenChange={setCaptchaToken}
                  purpose="REGISTER_EMAIL_CODE"
                  resetKey={captchaResetKey}
                />
              ) : (
                <AlertMessage
                  message={`验证码已发送。${countdown} 秒后可重新获取，重新获取前需要再次完成滑块验证。`}
                  variant="info"
                />
              )}

              <div className="space-y-2 pt-1">
                <CheckboxText text="同意用户协议" required />
                <CheckboxText text="同意隐私政策" required />
                <CheckboxText text="确认仅在授权范围内进行安全测试" required />
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65"
                disabled={submitting}
                type="submit"
              >
                {submitting ? '注册中...' : '立即注册'}
                <ArrowRight className="h-4 w-4" />
              </button>

              {message && (
                <AlertMessage message={message} onClose={() => setMessage('')} variant="success" />
              )}

              {error && (
                <AlertMessage message={error} onClose={() => setError('')} variant="error" />
              )}
            </form>

            <footer className="mt-5 border-t border-black/5 pt-5 text-center text-sm dark:border-white/5">
              <button className="text-slate-500 transition hover:text-brand-800 dark:text-white/45 dark:hover:text-brand-100" onClick={onSwitchToLogin} type="button">
                已有账号？立即登录
              </button>
            </footer>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-600/15 bg-brand-600/10 p-3 text-xs leading-5 text-brand-800 dark:border-brand-300/15 dark:text-brand-100/80">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              注册后需完成邮箱验证、安全答题与责任书签署，才可获得漏洞提交权限。
            </div>
          </>
        )}
      </motion.section>
    </div>
  )
}

function Input({
  className = '',
  icon,
  onChange,
  placeholder,
  required = false,
  type,
  value,
}: {
  className?: string
  icon: React.ReactNode
  onChange?: (value: string) => void
  placeholder: string
  required?: boolean
  type: string
  value?: string
}) {
  return (
    <label className={`relative block ${className}`}>
      <span className="absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-slate-400 dark:text-white/35 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <input
        className="w-full rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-300/60 dark:focus:ring-brand-300/50"
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  )
}

function CheckboxText({ required, text }: { required?: boolean; text: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-600 transition hover:text-slate-900 dark:text-white/60 dark:hover:text-white/80">
      <input className="mt-1 h-4 w-4 rounded border-black/10 bg-white/70 text-brand-600 dark:border-white/10 dark:bg-white/5" required={required} type="checkbox" />
      <span>{text}</span>
    </label>
  )
}
