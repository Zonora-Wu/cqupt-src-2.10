import {
  ArrowRight,
  Badge,
  ChevronsRight,
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

type RegisterModalProps = {
  onClose: () => void
  onSwitchToLogin: () => void
}

const identityTypes = ['本科生', '研究生', '教师', '信息化办老师', '社团/工作室成员', '校外访客']

export function RegisterModal({ onClose, onSwitchToLogin }: RegisterModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-8">
      <button
        aria-label="关闭注册弹窗"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-md dark:bg-black/70"
        onClick={onClose}
        type="button"
      />
      <motion.section
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative my-auto w-full max-w-[500px] rounded-lg border border-black/10 bg-white/90 p-8 text-slate-950 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#111411]/90 dark:text-white"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
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

        <form className="space-y-4">
          <Input icon={<User />} placeholder="用户名" type="text" />
          <Input icon={<Badge />} placeholder="统一认证码" type="text" />

          <label className="relative block">
            <GraduationCap className="absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-white/35" />
            <select
              className="w-full appearance-none rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-3 text-sm text-slate-950 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-brand-300/60 dark:focus:ring-brand-300/50"
              defaultValue=""
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

          <Input icon={<Mail />} placeholder="邮箱" type="email" />

          <div className="flex gap-3">
            <Input className="flex-1" icon={<Mail />} placeholder="邮箱验证码" type="text" />
            <button
              className="rounded-lg border border-black/10 bg-white/70 px-4 text-sm font-medium text-slate-800 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              type="button"
            >
              获取验证码
            </button>
          </div>

          <div>
            <label className="relative block">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-white/35" />
              <input
                className="w-full rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-11 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-300/60 dark:focus:ring-brand-300/50"
                placeholder="密码"
                type="password"
              />
              <EyeOff className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-white/35" />
            </label>
            <p className="mt-1 pl-1 text-xs leading-5 text-slate-500 dark:text-white/45">
              长度至少8位，需包含数字、字母及符号中至少两种组合
            </p>
          </div>

          <Input icon={<LockKeyhole />} placeholder="确认密码" type="password" />

          <div className="relative flex h-10 cursor-pointer items-center overflow-hidden rounded-lg border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <div className="absolute bottom-0 left-0 top-0 z-10 flex w-10 items-center justify-center border-r border-white/20 bg-brand-600 text-white transition hover:brightness-110">
              <ChevronsRight className="h-5 w-5" />
            </div>
            <div className="w-full select-none text-center text-xs font-medium text-slate-500 dark:text-white/40">
              向右滑动完成验证
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <CheckboxText text="同意用户协议" />
            <CheckboxText text="同意隐私政策" />
            <CheckboxText text="确认仅在授权范围内进行安全测试" />
          </div>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            type="submit"
          >
            立即注册
            <ArrowRight className="h-4 w-4" />
          </button>
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
      </motion.section>
    </div>
  )
}

function Input({
  className = '',
  icon,
  placeholder,
  type,
}: {
  className?: string
  icon: React.ReactNode
  placeholder: string
  type: string
}) {
  return (
    <label className={`relative block ${className}`}>
      <span className="absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-slate-400 dark:text-white/35 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <input
        className="w-full rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-300/60 dark:focus:ring-brand-300/50"
        placeholder={placeholder}
        type={type}
      />
    </label>
  )
}

function CheckboxText({ text }: { text: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-600 transition hover:text-slate-900 dark:text-white/60 dark:hover:text-white/80">
      <input className="mt-1 h-4 w-4 rounded border-black/10 bg-white/70 text-brand-600 dark:border-white/10 dark:bg-white/5" type="checkbox" />
      <span>{text}</span>
    </label>
  )
}
