import { useEffect, useState } from 'react'
import { listAiSkillReviews, reviewAiSkill, type AiSkillReviewItem } from '../../services/ai'
import { SurfacePanel } from '../ui/SurfacePanel'

export function AdminSkillReviewPanel() {
  const [items, setItems] = useState<AiSkillReviewItem[]>([])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const reload = () => listAiSkillReviews().then(setItems)

  useEffect(() => {
    const timer = window.setTimeout(() => void reload().catch(() => setMessage('声明式 Skill 审核队列加载失败')), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const decide = async (item: AiSkillReviewItem, decision: 'approve' | 'reject' | 'request-changes') => {
    const note = decision === 'approve' ? '' : window.prompt(decision === 'reject' ? '填写驳回原因' : '填写修改要求')?.trim()
    if (decision !== 'approve' && !note) return
    setBusy(item.id)
    try {
      await reviewAiSkill(item.id, decision, note)
      await reload()
      setMessage('审核结果已记录')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审核失败')
    } finally {
      setBusy('')
    }
  }

  return (
    <SurfacePanel className="p-5">
      <div className="flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">用户声明式 Skill 审核</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">系统只执行格式和权限检查，发布结论完全由管理员人工作出。</p></div><span className="text-sm text-slate-500">{items.length} 项</span></div>
      {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}
      <div className="mt-4 space-y-3">
        {items.map((item) => <div className="rounded-lg border border-black/10 p-4 dark:border-white/10" key={item.id}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.skill.title}</p><p className="mt-1 text-xs text-slate-500">提交人：{item.skill.createdBy?.name ?? '未知'} · {item.skill.createdBy?.unifiedCode ?? ''}</p><pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/5 p-3 text-xs leading-5 dark:bg-white/5">{item.skill.content}</pre>
              {!!item.skill.toolGrants?.length && <p className="mt-2 text-xs text-slate-500">申请工具：{item.skill.toolGrants.map((grant) => grant.toolName).join('、')}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2"><button className={approveClass} disabled={busy === item.id} onClick={() => void decide(item, 'approve')} type="button">通过发布</button><button className={normalClass} disabled={busy === item.id} onClick={() => void decide(item, 'request-changes')} type="button">要求修改</button><button className={rejectClass} disabled={busy === item.id} onClick={() => void decide(item, 'reject')} type="button">驳回</button></div>
          </div>
        </div>)}
        {!items.length && <p className="py-6 text-center text-sm text-slate-500">暂无待审核声明式 Skill</p>}
      </div>
    </SurfacePanel>
  )
}

const approveClass = 'rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50'
const normalClass = 'rounded-lg border border-black/10 px-3 py-2 text-sm font-medium dark:border-white/10 disabled:opacity-50'
const rejectClass = 'rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50'
