export type VulnStatus = '草稿' | '待审核' | '审核中' | '待补充' | '已确认' | '修复中' | '已归档'

export const STATUS_STYLES: Record<VulnStatus, string> = {
  草稿: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300',
  待审核: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  审核中: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-brand-300',
  待补充: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  已确认: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  修复中: 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  已归档: 'border-black/10 bg-[var(--app-panel-muted-bg)] text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300',
}
