import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createAiSkill, deleteAiSkill, getAiSkills, setAiSkillActive, updateAiSkill, updateAiSkillPresentation, type AiSkillLibraryItem } from '../../services/ai'
import { FloatingNotice } from '../ui/FloatingNotice'
import { SurfacePanel } from '../ui/SurfacePanel'

export function AdminSkillManagementPanel() {
  const [skills, setSkills] = useState<AiSkillLibraryItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [skillKind, setSkillKind] = useState<'SYSTEM' | 'USER'>('SYSTEM')
  const [selected, setSelected] = useState<AiSkillLibraryItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const reload = async () => {
    const result = await getAiSkills()
    setSkills(result.skills)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      void reload()
        .catch((reason) => setError(reason instanceof Error ? reason.message : 'Skill 加载失败'))
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const visible = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    const scoped = skills.filter((skill) => skill.skillKind === skillKind)
    return query ? scoped.filter((skill) => `${skill.title} ${skill.slug ?? ''} ${skill.source ?? ''} ${skill.createdBy?.name ?? ''} ${skill.createdBy?.unifiedCode ?? ''}`.toLowerCase().includes(query)) : scoped
  }, [keyword, skillKind, skills])
  const systemCount = skills.filter((skill) => skill.skillKind === 'SYSTEM').length
  const userCount = skills.filter((skill) => skill.skillKind === 'USER').length

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusy(id)
    setError('')
    try { await action(); await reload(); setMessage(success); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败'); return false }
    finally { setBusy('') }
  }

  return (
    <>
      {(message || error) && <FloatingNotice message={error || message} onClose={() => { setMessage(''); setError('') }} variant={error ? 'error' : 'success'} />}
      <SurfacePanel className="overflow-hidden p-0">
        <div className="flex gap-1 border-b border-black/10 px-5 pt-3 dark:border-white/10" role="tablist" aria-label="Skill 类型">
          <KindTab active={skillKind === 'SYSTEM'} label={`系统 Skill ${systemCount}`} onClick={() => setSkillKind('SYSTEM')} />
          <KindTab active={skillKind === 'USER'} label={`用户 Skill ${userCount}`} onClick={() => setSkillKind('USER')} />
        </div>
        <div className="flex flex-col gap-3 border-b border-black/10 px-4 py-4 dark:border-white/10 sm:px-5 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-base font-semibold">{skillKind === 'SYSTEM' ? '系统 Skill' : '用户 Skill'}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{skillKind === 'SYSTEM' ? '管理平台维护的 Skill 及用户侧入口' : '查看用户创建和提交的 Skill'}，当前 {visible.length} 个</p></div>
          <div className="flex w-full gap-2 md:w-auto">
            <input autoComplete="off" className={`${inputClass} min-w-0 flex-1 md:w-64`} maxLength={120} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称、标识或来源" value={keyword} />
            {skillKind === 'SYSTEM' && <button className={primaryButton} onClick={() => setCreating(true)} type="button">新建 Skill</button>}
          </div>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {loading && <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">正在加载 Skill...</div>}
          {!loading && visible.map((skill) => (
            <div className="grid gap-4 px-4 py-4 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:px-5 xl:grid-cols-[minmax(230px,1.25fr)_minmax(240px,1fr)_minmax(260px,1.1fr)_auto] xl:items-center" key={skill.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{skill.title}</p>
                  <StatusBadge active={skill.active !== false} lifecycleStatus={skill.lifecycleStatus} />
                </div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{skill.slug ? `/${skill.slug}` : skill.id}</p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Metadata label={skillKind === 'SYSTEM' ? '适用范围' : '创建者'} value={skillKind === 'SYSTEM' ? spaceLabel(skill.aiSpace) : `${skill.createdBy?.name ?? '未知用户'}${skill.createdBy?.unifiedCode ? ` · ${skill.createdBy.unifiedCode}` : ''}`} />
                <Metadata label="生命周期" value={lifecycleLabel(skill.lifecycleStatus)} />
                <Metadata label="版本" value={`v${(skill as AiSkillLibraryItem & { version?: number }).version ?? 1}`} />
                <Metadata label="来源" value={sourceLabel(skill.source)} />
              </dl>

              {skillKind === 'SYSTEM' ? (
                <div className="grid grid-cols-2 gap-3">
                  <PresentationControl
                    checked={skill.visibleToUsers === true}
                    disabled={busy === skill.id || skill.lifecycleStatus !== 'PUBLISHED'}
                    label="用户侧展示"
                    onChange={(checked) => void run(skill.id, () => updateAiSkillPresentation(skill.id, { visibleToUsers: checked, ...(checked ? {} : { defaultPinnedForUsers: false }) }), checked ? '已在用户侧展示' : '已从用户侧隐藏')}
                  />
                  <PresentationControl
                    checked={skill.defaultPinnedForUsers === true}
                    disabled={busy === skill.id || !skill.visibleToUsers || skill.lifecycleStatus !== 'PUBLISHED'}
                    label="默认固定"
                    onChange={(checked) => void run(skill.id, () => updateAiSkillPresentation(skill.id, { defaultPinnedForUsers: checked }), checked ? '已设为用户默认 Skill' : '已取消默认固定')}
                  />
                </div>
              ) : <div className="hidden xl:block" />}

              <div className="flex flex-wrap justify-end gap-2 xl:flex-nowrap">
                <button className={secondaryButton} onClick={() => setSelected(skill)} type="button">详情</button>
                <button className={secondaryButton} disabled={busy === skill.id || skill.lifecycleStatus === 'ARCHIVED'} onClick={() => void run(skill.id, () => setAiSkillActive(skill.id, skill.active === false), skill.active === false ? 'Skill 已启用' : 'Skill 已停用')} type="button">{skill.active === false ? '启用' : '停用'}</button>
                <button className={dangerButton} disabled={busy === skill.id || skill.lifecycleStatus === 'ARCHIVED'} onClick={() => { if (window.confirm(`确认归档 ${skill.title}？`)) void run(skill.id, () => deleteAiSkill(skill.id), 'Skill 已归档') }} type="button">归档</button>
              </div>
            </div>
          ))}
          {!loading && !visible.length && (
            <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              <p>没有符合条件的 Skill</p>
              {error && <button className={`${secondaryButton} mt-3`} onClick={() => {
                setLoading(true)
                setError('')
                void reload()
                  .catch((reason) => setError(reason instanceof Error ? reason.message : 'Skill 加载失败'))
                  .finally(() => setLoading(false))
              }} type="button">重新加载</button>}
            </div>
          )}
        </div>
      </SurfacePanel>
      {(selected || creating) && <SkillEditorDialog creating={creating} onClose={() => { setSelected(null); setCreating(false) }} onSave={async (title, content) => {
        const saved = await run(selected?.id ?? 'create', () => selected ? updateAiSkill(selected.id, { title, content }) : createAiSkill({ title, content }), selected ? 'Skill 已更新' : 'Skill 已创建')
        if (saved) { setSelected(null); setCreating(false) }
      }} skill={selected} />}
    </>
  )
}

function KindTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-selected={active} className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${active ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`} onClick={onClick} role="tab" type="button">{label}</button>
}

function SwitchButton({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <button aria-label={label} aria-pressed={checked} className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`} disabled={disabled} onClick={() => onChange(!checked)} type="button"><span className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button>
}

function PresentationControl({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 dark:border-white/10"><span className="truncate text-xs text-slate-600 dark:text-slate-300">{label}</span><SwitchButton checked={checked} disabled={disabled} label={label} onChange={onChange} /></div>
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-slate-400 dark:text-slate-500">{label}</dt><dd className="mt-0.5 truncate text-slate-700 dark:text-slate-200" title={value}>{value}</dd></div>
}

function StatusBadge({ active, lifecycleStatus }: { active: boolean; lifecycleStatus?: AiSkillLibraryItem['lifecycleStatus'] }) {
  const archived = lifecycleStatus === 'ARCHIVED'
  const label = archived ? '已归档' : active ? '可用' : '已停用'
  const className = archived || !active
    ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${className}`}>{label}</span>
}

function lifecycleLabel(status?: AiSkillLibraryItem['lifecycleStatus']) {
  const labels: Record<NonNullable<AiSkillLibraryItem['lifecycleStatus']>, string> = {
    ACTIVE_PRIVATE: '私有启用',
    ARCHIVED: '已归档',
    CHANGES_REQUESTED: '待修改',
    DISABLED: '已停用',
    DRAFT: '草稿',
    FAILED: '处理失败',
    PUBLISHED: '已发布',
    REJECTED: '已驳回',
    SUBMITTED: '已提交',
    UNDER_REVIEW: '审核中',
  }
  return status ? labels[status] : '未确认'
}

function sourceLabel(source: string | null) {
  if (source === 'DECLARATIVE_SYSTEM') return '平台声明式'
  if (source === 'DECLARATIVE_USER') return '用户声明式'
  if (source === 'platform-default') return '平台内置'
  return source || '未标记'
}

function spaceLabel(space: AiSkillLibraryItem['aiSpace']) {
  return { ADMIN: '管理员', AUDITOR: '审核员', STUDENT: '用户' }[space]
}

function SkillEditorDialog({ creating, onClose, onSave, skill }: { creating: boolean; onClose: () => void; onSave: (title: string, content: string) => Promise<void>; skill: AiSkillLibraryItem | null }) {
  const [title, setTitle] = useState(skill?.title ?? '')
  const [content, setContent] = useState(skill?.content ?? '')
  const editable = creating || skill?.skillKind === 'SYSTEM' || ['DRAFT', 'ACTIVE_PRIVATE', 'CHANGES_REQUESTED', 'REJECTED'].includes(skill?.lifecycleStatus ?? '')
  return createPortal(<div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="presentation"><section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-[var(--app-surface)] text-slate-950 shadow-2xl ring-1 ring-black/10 dark:text-white dark:ring-white/10" role="dialog" aria-modal="true"><header className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10"><div><h3 className="text-base font-semibold">{creating ? '新建 Skill' : 'Skill 详情'}</h3>{skill && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{skill.lifecycleStatus} · {skill.aiSpace} · {skill.slug ?? skill.id}</p>}</div><button className={secondaryButton} onClick={onClose} type="button">关闭</button></header><div className="min-h-0 flex-1 overflow-y-auto p-5"><label className="block text-xs font-medium">名称<input autoComplete="off" className={`${inputClass} mt-1.5 w-full`} disabled={!editable} maxLength={80} onChange={(event) => setTitle(event.target.value)} value={title} /></label><label className="mt-4 block text-xs font-medium">SKILL.md 内容<textarea className={`${inputClass} mt-1.5 min-h-80 w-full resize-y font-mono text-xs leading-6`} disabled={!editable} maxLength={30000} onChange={(event) => setContent(event.target.value)} value={content} /></label></div>{editable && <footer className="flex justify-end border-t border-black/10 px-5 py-4 dark:border-white/10"><button className={primaryButton} disabled={!title.trim() || !content.trim()} onClick={() => void onSave(title.trim(), content)} type="button">保存</button></footer>}</section></div>, document.body)
}

const inputClass = 'min-w-0 rounded-lg border border-black/10 bg-[var(--app-surface)] px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-white dark:placeholder:text-slate-500'
const primaryButton = 'rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton = 'rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 disabled:opacity-50'
const dangerButton = 'rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400 disabled:opacity-50'
