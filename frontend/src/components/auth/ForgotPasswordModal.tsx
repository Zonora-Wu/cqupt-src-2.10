import { ArrowLeft, Eye, EyeOff, Lock, Mail, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { isValidEmail, resetPassword, sendPasswordResetCode } from '../../services/auth'
import { createHumanVerificationPayload } from '../../services/humanVerification'
import { PlatformHumanVerification } from '../security/PlatformHumanVerification'
import { AlertMessage } from '../ui/AlertMessage'

type ForgotPasswordModalProps = {
  onBack: () => void
  onClose: () => void
}

type Notice = { text: string; type: 'error' | 'info' | 'success' | 'warning' }

export function ForgotPasswordModal({ onBack, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [humanPayload, setHumanPayload] = useState('')
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [humanResetKey, setHumanResetKey] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const normalizedEmail = email.trim().toLowerCase()
  const EyeIcon = showPassword ? Eye : EyeOff

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])

  const handleHumanChange = useCallback((payload: string) => {
    setHumanPayload(payload)
    setVerifiedEmail(payload ? normalizedEmail : '')
  }, [normalizedEmail])

  const sendCode = async () => {
    if (sending || countdown > 0) return
    setNotice(null)
    if (!isValidEmail(normalizedEmail)) {
      setNotice({ text: '请输入正确的邮箱地址', type: 'warning' })
      return
    }
    if (!humanPayload || verifiedEmail !== normalizedEmail) {
      setNotice({ text: '请使用当前邮箱完成安全校验', type: 'warning' })
      return
    }
    try {
      setSending(true)
      const result = await sendPasswordResetCode(normalizedEmail, createHumanVerificationPayload(humanPayload).humanVerification)
      setCountdown(60)
      setNotice({ text: result.message, type: 'success' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : '验证码发送失败', type: 'error' })
    } finally {
      setHumanPayload('')
      setVerifiedEmail('')
      setHumanResetKey((value) => value + 1)
      setSending(false)
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    if (!/^\d{6}$/.test(code)) {
      setNotice({ text: '请输入 6 位邮箱验证码', type: 'warning' })
      return
    }
    if (newPassword.length < 8 || !hasEnoughPasswordCategories(newPassword)) {
      setNotice({ text: '密码至少 8 位，并包含字母、数字、符号中至少两类', type: 'warning' })
      return
    }
    if (newPassword !== confirmPassword) {
      setNotice({ text: '两次输入的密码不一致', type: 'warning' })
      return
    }
    try {
      setSubmitting(true)
      const result = await resetPassword({ code, email: normalizedEmail, newPassword })
      setNotice({ text: result.message, type: 'success' })
      window.setTimeout(onBack, 900)
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : '密码重置失败', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] isolate flex items-center justify-center px-4 py-8">
      <button aria-label="关闭找回密码弹窗" className="absolute inset-0 bg-slate-950/45 dark:bg-black/70" onClick={onClose} type="button" />
      <motion.section animate={{ opacity: 1, y: 0 }} className="relative max-h-[calc(100vh-2rem)] w-full max-w-[440px] overflow-y-auto rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-7 text-slate-950 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:text-white" initial={{ opacity: 0, y: 12 }} transition={{ duration: 0.18 }}>
        <button aria-label="关闭" className="absolute right-4 top-4 rounded-md p-2 text-slate-500 hover:bg-black/5 dark:text-white/45 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="h-4 w-4" /></button>
        <button className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white" onClick={onBack} type="button"><ArrowLeft className="h-4 w-4" />返回登录</button>
        <h2 className="text-xl font-semibold">找回密码</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">验证账号绑定邮箱后设置新密码。其他设备将在当前登录状态到期后退出。</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field icon={<Mail />}><input autoComplete="email" className={inputClass} onChange={(event) => {
            const value = event.target.value
            setEmail(value)
            if ((humanPayload || verifiedEmail) && value.trim().toLowerCase() !== verifiedEmail) {
              setHumanPayload('')
              setVerifiedEmail('')
              setHumanResetKey((key) => key + 1)
            }
          }} maxLength={120} placeholder="账号绑定邮箱" type="email" value={email} /></Field>
          <div className="flex gap-2">
            <Field className="min-w-0 flex-1" icon={<Lock />}><input autoComplete="one-time-code" className={inputClass} inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位验证码" value={code} /></Field>
            <button className="w-28 shrink-0 rounded-lg border border-black/10 px-3 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10" disabled={sending || countdown > 0} onClick={() => void sendCode()} type="button">{sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}</button>
          </div>
          <PlatformHumanVerification compact disabled={countdown > 0} helperText="完成后可获取找回密码验证码。" onChange={handleHumanChange} onError={(text) => setNotice({ text, type: 'error' })} purpose="RESET_PASSWORD" resetKey={`reset-${humanResetKey}`} />
          <Field icon={<Lock />}><input autoComplete="new-password" className={`${inputClass} pr-11`} maxLength={128} onChange={(event) => setNewPassword(event.target.value)} placeholder="新密码，至少 8 位" type={showPassword ? 'text' : 'password'} value={newPassword} /><button aria-label={showPassword ? '隐藏密码' : '显示密码'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPassword((value) => !value)} type="button"><EyeIcon className="h-5 w-5" /></button></Field>
          <Field icon={<Lock />}><input autoComplete="new-password" className={inputClass} maxLength={128} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" type={showPassword ? 'text' : 'password'} value={confirmPassword} /></Field>
          {notice && <AlertMessage message={notice.text} onClose={() => setNotice(null)} variant={notice.type} />}
          <button className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">{submitting ? '正在重置...' : '重置密码'}</button>
        </form>
      </motion.section>
    </div>
  )
}

function Field({ children, className = '', icon }: { children: React.ReactNode; className?: string; icon: React.ReactNode }) {
  return <label className={`group relative block ${className}`}><span className="absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>{children}</label>
}

const inputClass = 'w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] py-3 pl-11 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:text-white dark:placeholder:text-white/30'

function hasEnoughPasswordCategories(value: string) {
  return [/[A-Za-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length >= 2
}
