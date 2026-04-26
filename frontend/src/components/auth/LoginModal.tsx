import { ArrowRight, ChevronsRight, Lock, Mail, User, X } from 'lucide-react'
import { motion } from 'motion/react'

type LoginModalProps = {
  onClose: () => void
  onSwitchToRegister: () => void
}

export function LoginModal({ onClose, onSwitchToRegister }: LoginModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
      <button
        aria-label="关闭登录弹窗"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-md dark:bg-black/70"
        onClick={onClose}
        type="button"
      />
      <motion.section
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-[420px] rounded-lg border border-black/10 bg-white/90 p-8 text-slate-950 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#111411]/85 dark:text-white"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
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
            src="/assets/logos/CQUPT_02_logo.png"
          />
          <img
            alt="CQUPT-SRC Logo"
            className="mb-3 hidden h-24 w-auto object-contain opacity-95 dark:block"
            src="/assets/logos/CQUPT_02_logo_dark.png"
          />
          <p className="mt-1 text-sm text-slate-500 dark:text-white/50">CQUPT-SRC 校园漏洞响应平台</p>
        </header>

        <div className="mb-5 grid grid-cols-2 border-b border-black/10 text-sm font-medium dark:border-white/10">
          <button className="border-b-2 border-brand-600 pb-3 text-brand-700 dark:border-brand-200 dark:text-brand-100" type="button">
            统一认证登录
          </button>
          <button className="pb-3 text-slate-400 transition hover:text-slate-800 dark:text-white/40 dark:hover:text-white/75" type="button">
            邮箱验证登录
          </button>
        </div>

        <form className="space-y-5">
          <div className="space-y-3">
            <label className="group relative block">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
              <input
                className="w-full rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                placeholder="统一认证号 / 学号"
                type="text"
              />
            </label>
            <label className="group relative block">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-700 dark:text-white/30 dark:group-focus-within:text-brand-200" />
              <input
                className="w-full rounded-lg border border-black/10 bg-white/70 py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                placeholder="密码"
                type="password"
              />
            </label>
          </div>

          <div className="relative flex h-10 cursor-pointer items-center overflow-hidden rounded-lg border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <div className="absolute bottom-0 left-0 top-0 z-10 flex w-10 items-center justify-center border-r border-white/20 bg-brand-600 text-white transition hover:brightness-110">
              <ChevronsRight className="h-5 w-5" />
            </div>
            <div className="w-full select-none text-center text-xs font-medium text-slate-500 dark:text-white/40">
              向右滑动完成验证
            </div>
          </div>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            type="submit"
          >
            登录
          </button>
        </form>

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
