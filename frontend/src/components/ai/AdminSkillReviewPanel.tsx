import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { listAiSkillReviews, reviewAiSkill, type AiSkillReviewItem } from '../../services/ai'
import { SurfacePanel } from '../ui/SurfacePanel'

export function AdminSkillReviewPanel() {
  const [items, setItems] = useState<AiSkillReviewItem[]>([])
  const [selected, setSelected] = useState<AiSkillReviewItem | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const reload = () => listAiSkillReviews().then(setItems)

  useEffect(() => {
    const timer = window.setTimeout(() => void reload().catch(() => setMessage('声明式 Skill 审核队列加载失败')), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const decide = async (item: AiSkillReviewItem, decision: 'approve' | 'reject' | 'request-changes', note: string) => {
    setBusy(item.id)
    try {
      await reviewAiSkill(item.id, decision, note)
      await reload()
      setSelected(null)
      setMessage('审核结果已记录')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审核失败')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <SurfacePanel className="overflow-hidden p-0">
        <div className="flex items-end justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10"><div><h2 className="text-base font-semibold">用户 Skill 审核</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">发布结论由管理员人工作出</p></div><span className="text-sm text-slate-500 dark:text-slate-400">{items.length} 项待处理</span></div>
        {message && <p className="border-b border-black/10 px-5 py-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">{message}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-black/[0.025] text-xs text-slate-500 dark:bg-white/[0.03]"><tr><th className="px-5 py-3 font-medium">Skill</th><th className="px-4 py-3 font-medium">提交人</th><th className="px-4 py-3 font-medium">工具权限</th><th className="px-4 py-3 font-medium">提交时间</th><th className="px-5 py-3 text-right font-medium">操作</th></tr></thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {items.map((item) => <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" key={item.id}><td className="px-5 py-3"><p className="font-medium">{item.skill.title}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.skill.slug ? `/${item.skill.slug}` : item.skill.id}</p></td><td className="px-4 py-3">{item.skill.createdBy?.name ?? '未知'}<p className="text-xs text-slate-500 dark:text-slate-400">{item.skill.createdBy?.unifiedCode ?? '-'}</p></td><td className="px-4 py-3">{item.skill.toolGrants?.length ?? 0} 项</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(item.submittedAt).toLocaleString()}</td><td className="px-5 py-3 text-right"><button className={secondaryButton} onClick={() => setSelected(item)} type="button">审核详情</button></td></tr>)}
              {!items.length && <tr><td className="px-5 py-10 text-center text-slate-500 dark:text-slate-400" colSpan={5}>暂无待审核 Skill</td></tr>}
            </tbody>
          </table>
        </div>
      </SurfacePanel>
      {selected && <SkillReviewDialog busy={busy === selected.id} item={selected} onClose={() => setSelected(null)} onDecide={decide} />}
    </>
  )
}

function SkillReviewDialog({ busy, item, onClose, onDecide }: { busy: boolean; item: AiSkillReviewItem; onClose: () => void; onDecide: (item: AiSkillReviewItem, decision: 'approve' | 'reject' | 'request-changes', note: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  return createPortal(<div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="presentation"><section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-[var(--app-surface)] text-slate-950 shadow-2xl ring-1 ring-black/10 dark:text-white dark:ring-white/10" aria-modal="true" role="dialog"><header className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10"><div><h3 className="text-base font-semibold">{item.skill.title}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">提交人：{item.skill.createdBy?.name ?? '未知'} · {item.skill.createdBy?.unifiedCode ?? '-'}</p></div><button className={secondaryButton} onClick={onClose} type="button">关闭</button></header><div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]"><pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 text-xs leading-6 dark:border-white/10">{item.skill.content}</pre><div><p className="text-xs font-medium">申请工具</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.skill.toolGrants?.map((grant) => grant.toolName).join('、') || '无'}</p><label className="mt-5 block text-xs font-medium">审核意见<textarea className="mt-1.5 min-h-32 w-full rounded-lg border border-black/10 bg-[var(--app-surface)] px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600/25 dark:border-white/15 dark:text-white dark:placeholder:text-slate-500" onChange={(event) => setNote(event.target.value)} placeholder="要求修改或驳回时必填" value={note} /></label></div></div></div><footer className="flex flex-wrap justify-end gap-2 border-t border-black/10 px-5 py-4 dark:border-white/10"><button className={approveButton} disabled={busy} onClick={() => void onDecide(item, 'approve', note)} type="button">通过发布</button><button className={secondaryButton} disabled={busy || !note.trim()} onClick={() => void onDecide(item, 'request-changes', note.trim())} type="button">要求修改</button><button className={rejectButton} disabled={busy || !note.trim()} onClick={() => void onDecide(item, 'reject', note.trim())} type="button">驳回</button></footer></section></div>, document.body)
}

const secondaryButton = 'rounded-lg border border-black/10 px-3 py-2 text-sm font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 disabled:opacity-50'
const approveButton = 'rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
const rejectButton = 'rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 disabled:opacity-50'
