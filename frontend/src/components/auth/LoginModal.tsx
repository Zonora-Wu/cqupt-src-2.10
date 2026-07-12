import { ArrowRight, Eye, EyeOff, Lock, Mail, User, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { AlertMessage } from '../ui/AlertMessage'
import { PlatformHumanVerification } from '../security/PlatformHumanVerification'
import { ApiError } from '../../services/apiClient'
import {
  type AuthUser,
  isValidEmail,
  normalizeUnifiedCode,
  loginWithEmailCode,
  loginWithUnifiedCode,
  sendEmailLoginCode,
} from '../../services/auth'
import { createHumanVerificationPayload } from '../../services/humanVerification'
import { getPlatformLogos, subscribePlatformBranding } from '../../utils/platformBranding'

type LoginModalProps = {
  onClose: () => void
  onLoginSuccess: (user: AuthUser) => void
  onSwitchToRegister: () => void
}

type LoginMode = 'email' | 'sso'
type NoticeState = { text: string; type: 'error' | 'info' | 'success' | 'warning' }

export function LoginModal({ onClose, onLoginSuccess, onSwitchToRegister }: LoginModalProps) {
  const [mode, setMode] = useState<LoginMode>('sso')
  const [unifiedCode, setUnifiedCode] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailHumanPayload, setEmailHumanPayload] = useState('')
  const [emailHumanVerifiedFor, setEmailHumanVerifiedFor] = useState('')
  const [passwordHumanPayload, setPasswordHumanPayload] = useState('')
  const [humanResetKey, setHumanResetKey] = useState(0)
  const [emailCodeSentTo, setEmailCodeSentTo] = useState('')
  const [message, setMessage] = useState<NoticeState | null>(null)
  const [logos, setLogos] = useState(() => getPlatformLogos())
  const normalizedEmail = email.trim().toLowerCase()
  const handleEmailHumanPayloadChange = useCallback((payload: string) => {
    setEmailHumanPayload(payload)
    setEmailHumanVerifiedFor(payload ? normalizedEmail : '')
  }, [normalizedEmail])

  useEffect(() => {
    document.documentElement.classList.add('auth-modal-open')
    return () => document.documentElement.classList.remove('auth-modal-open')
  }, [])

  useEffect(() => subscribePlatformBranding(setLogos), [])

  useEffect(() => {
    if (countdown <= 0) return

    const timer = window.setTimeout(() => {
      setCountdown((value) => value - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    if (mode !== 'email' || countdown !== 0 || !emailCodeSentTo) return
    setEmailHumanPayload('')
    setEmailHumanVerifiedFor('')
    setHumanResetKey((value) => value + 1)
  }, [countdown, emailCodeSentTo, mode])

  const handleSendEmailCode = async () => {
    if (countdown > 0 || isSendingCode) return

    setMessage(null)

    if (!isValidEmail(email)) {
      setMessage({ text: '请输入正确的邮箱地址', type: 'warning' })
      return
    }

    if (!emailHumanPayload) {
      setMessage({ text: '请先完成安全校验，再获取邮箱验证码', type: 'warning' })
      return
    }

    if (emailHumanVerifiedFor !== normalizedEmail) {
      setMessage({ text: '邮箱已变化，请重新完成安全校验', type: 'warning' })
      setEmailHumanPayload('')
      setHumanResetKey((value) => value + 1)
      return
    }

    try {
      setIsSendingCode(true)
      const result = await sendEmailLoginCode(email, createHumanVerificationPayload(emailHumanPayload).humanVerification)
      setCountdown(60)
      setEmailCodeSentTo(email.trim().toLowerCase())
      setMessage({
        text: result.devCode ? `${result.message}，开发验证码为 ${result.devCode}` : result.message,
        type: 'success',
      })
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: 'error' })
      setEmailHumanPayload('')
      setEmailHumanVerifiedFor('')
      setHumanResetKey((value) => value + 1)
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (mode === 'sso' && !passwordHumanPayload) {
      setMessage({ text: '请先完成安全校验', type: 'warning' })
      return
    }

    if (mode === 'email' && normalizedEmail !== emailCodeSentTo) {
      setMessage({ text: '请先获取当前邮箱的验证码', type: 'warning' })
      return
    }

    if (mode === 'email' && !/^\d{6}$/.test(emailCode)) {
      setMessage({ text: '请输入 6 位邮箱验证码', type: 'warning' })
      return
    }

    try {
      setIsSubmitting(true)
      const result =
        mode === 'sso'
          ? await loginWithUnifiedCode({
              code: unifiedCode,
              password,
              ...(passwordHumanPayload ? createHumanVerificationPayload(passwordHumanPayload) : {}),
            })
          : await loginWithEmailCode({ code: emailCode, email })
      setMessage({ text: '登录成功，正在进入用户首页', type: 'success' })
      window.setTimeout(() => {
        onLoginSuccess(result.user)
      }, 300)
    } catch (error) {
      if (requiresHumanVerification(error)) {
        setPasswordHumanPayload('')
        setHumanResetKey((value) => value + 1)
      }
      setMessage({ text: getErrorMessage(error), type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] isolate flex items-center justify-center px-4 py-8">
      <button
        aria-label="关闭登录弹窗"
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
          aria-label="关闭登录弹窗"
          className="absolute right-4 top-4 rounded-md p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="mb-6 flex flex-col items-center text-center">
          <img
            alt="CQUPT-SRC Logo"
            className="mb-3 h-32 w-auto object-contain opacity-95 dark:hidden"
            src={logos.authLogoUrl}
          />
          <img
            alt="CQUPT-SRC Logo"
            className="mb-3 hidden h-24 w-auto object-contain opacity-95 dark:block"
            src={logos.authLogoUrlDark}
          />
          <p className="mt-1 text-sm text-slate-500 dark:text-white/50">CQUPT-SRC 校园漏洞响应平台</p>
        </header>

        <div className="mb-5 grid grid-cols-2 border-b border-black/10 text-sm font-medium dark:border-white/10">
          <button
            className={`border-b-2 pb-3 transition ${
              mode === 'sso'
                ? 'border-brand-600 text-brand-700 dark:border-brand-200 dark:text-brand-100'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/75'
            }`}
            onClick={() => {
              setMode('sso')
              setMessage(null)
              setEmailHumanPayload('')
              setEmailHumanVerifiedFor('')
              setPasswordHumanPayload('')
              setHumanResetKey((value) => value + 1)
            }}
            type="button"
          >
            统一认证登录
          </button>
          <button
            className={`border-b-2 pb-3 transition ${
              mode === 'email'
                ? 'border-brand-600 text-brand-700 dark:border-brand-200 dark:text-brand-100'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/75'
            }`}
            onClick={() => {
              setMode('email')
              setMessage(null)
              setEmailHumanPayload('')
              setEmailHumanVerifiedFor('')
              setPasswordHumanPayload('')
              setHumanResetKey((value) => value + 1)
            }}
            type="button"
          >
            邮箱验证登录
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {mode === 'sso' ? (
            <SsoLoginFields
              password={password}
              unifiedCode={unifiedCode}
              onPasswordChange={setPassword}
              onUnifiedCodeChange={(value) => setUnifiedCode(normalizeUnifiedCode(value))}
            />
          ) : (
            <EmailLoginFields
              countdown={countdown}
              email={email}
              emailCode={emailCode}
              isSendingCode={isSendingCode}
              onCodeChange={setEmailCode}
              onEmailChange={(value) => {
                setEmail(value)
                if (value.trim().toLowerCase() !== emailCodeSentTo) {
                  setEmailCodeSentTo('')
                }
                if ((emailHumanPayload || emailHumanVerifiedFor) && value.trim().toLowerCase() !== emailHumanVerifiedFor) {
                  setEmailHumanPayload('')
                  setEmailHumanVerifiedFor('')
                  setHumanResetKey((current) => current + 1)
                }
              }}
              onSendCode={handleSendEmailCode}
            />
          )}

          <PlatformHumanVerification
            compact={mode === 'sso'}
            disabled={mode === 'email' && countdown > 0}
            helperText={mode === 'email' ? '完成后可获取邮箱验证码。' : undefined}
            onChange={mode === 'email' ? handleEmailHumanPayloadChange : setPasswordHumanPayload}
            onError={(text) => setMessage({ text, type: 'error' })}
            purpose={mode === 'email' ? 'LOGIN_EMAIL_CODE' : 'LOGIN_PASSWORD'}
            resetKey={`${mode}-${humanResetKey}`}
          />

          {mode === 'email' && countdown > 0 && (
            <AlertMessage
              message={`验证码已发送。${countdown} 秒后可重新获取，重新获取前需要再次完成安全校验。`}
              variant="info"
            />
          )}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '登录中...' : '登录'}
          </button>
        </form>

        {message && (
          <AlertMessage
            className="mt-4 text-xs"
            message={message.text}
            onClose={() => setMessage(null)}
            variant={message.type}
          />
        )}

        <footer className="mt-5 flex items-center justify-between border-t border-black/5 pt-5 text-sm dark:border-white/5">
          <button className="text-slate-500 transition hover:text-slate-950 dark:text-white/40 dark:hover:text-white" type="button">
            忘记密码?
          </button>
          <button
            className="inline-flex items-center gap-1 text-brand-700 transition hover:text-brand-900 dark:text-brand-100 dark:hover:text-white"
            onClick={onSwitchToRegister}
            type="button"
          >
            立即注册
            <ArrowRight className="h-4 w-4" />
          </button>
        </footer>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-600/15 bg-brand-600/10 p-3 text-xs leading-5 text-brand-800 dark:border-brand-300/15 dark:text-brand-100/80">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          登录后请先完成安全答题与责任书签署，再进行漏洞提交。
        </div>
      </motion.section>
    </div>
  )
}

function SsoLoginFields({
  onPasswordChange,
  onUnifiedCodeChange,
  password,
  unifiedCode,
}: {
  onPasswordChange: (value: string) => void
  onUnifiedCodeChange: (value: string) => void
  password: string
  unifiedCode: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const EyeIcon = showPassword ? Eye : EyeOff

  return (
    <div className="space-y-3">
      <label className="group relative block">
        <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
        <input
          className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
          inputMode="numeric"
          maxLength={7}
          onChange={(event) => onUnifiedCodeChange(event.target.value)}
          pattern="\d{7}"
          placeholder="统一认证码"
          type="text"
          value={unifiedCode}
        />
      </label>
      <div className="group relative">
        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
        <input
          className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-11 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="密码"
          type={showPassword ? 'text' : 'password'}
          value={password}
        />
        <button
          aria-label={showPassword ? '隐藏密码' : '显示密码'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60"
          onClick={() => setShowPassword((v) => !v)}
          type="button"
        >
          <EyeIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function EmailLoginFields({
  countdown,
  email,
  emailCode,
  isSendingCode,
  onCodeChange,
  onEmailChange,
  onSendCode,
}: {
  countdown: number
  email: string
  emailCode: string
  isSendingCode: boolean
  onCodeChange: (value: string) => void
  onEmailChange: (value: string) => void
  onSendCode: () => void
}) {
  return (
    <div className="space-y-3">
      <label className="group relative block">
        <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
        <input
          autoComplete="email"
          className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="邮箱"
          type="email"
          value={email}
        />
      </label>

      <div className="flex gap-3">
        <label className="group relative block flex-1">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
          <input
            autoComplete="one-time-code"
            className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 位验证码"
            type="text"
            value={emailCode}
          />
        </label>
        <button
          className="w-28 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 text-sm font-medium text-slate-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10  dark:text-white dark:hover:bg-white/10"
          disabled={countdown > 0 || isSendingCode}
          onClick={onSendCode}
          type="button"
        >
          {isSendingCode ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
        </button>
      </div>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return '操作失败，请稍后重试'
}

function requiresHumanVerification(error: unknown) {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== 'object') return false
  const data = error.data as { requiresHumanVerification?: unknown; message?: unknown }
  if (data.requiresHumanVerification === true) return true
  const response = 'response' in data && data.response && typeof data.response === 'object'
    ? data.response as { requiresHumanVerification?: unknown }
    : null
  return response?.requiresHumanVerification === true
}
