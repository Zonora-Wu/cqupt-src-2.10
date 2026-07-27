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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const reload = () => getAiSkills().then((result) => setSkills(result.skills))
  useEffect(() => { const timer = window.setTimeout(() => void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Skill 加载失败')), 0); return () => window.clearTimeout(timer) }, [])

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
        <div className="flex flex-col gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-base font-semibold">{skillKind === 'SYSTEM' ? '系统 Skill' : '用户 Skill'}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{skillKind === 'SYSTEM' ? '管理平台维护的 Skill 及用户侧入口' : '查看用户创建和提交的 Skill'}，当前 {visible.length} 个</p></div>
          <div className="flex gap-2">
            <input className={inputClass} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称、标识或来源" value={keyword} />
            {skillKind === 'SYSTEM' && <button className={primaryButton} onClick={() => setCreating(true)} type="button">新建 Skill</button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-black/[0.025] text-xs text-slate-500 dark:bg-white/[0.03] dark:text-slate-400"><tr><th className="px-5 py-3 font-medium">名称</th><th className="px-4 py-3 font-medium">{skillKind === 'SYSTEM' ? '范围' : '创建者'}</th><th className="px-4 py-3 font-medium">生命周期</th><th className="px-4 py-3 font-medium">版本</th><th className="px-4 py-3 font-medium">来源</th>{skillKind === 'SYSTEM' && <><th className="px-4 py-3 font-medium">用户侧展示</th><th className="px-4 py-3 font-medium">默认固定</th></>}<th className="px-4 py-3 font-medium">状态</th><th className="px-5 py-3 text-right font-medium">操作</th></tr></thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {visible.map((skill) => (
                <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" key={skill.id}>
                  <td className="px-5 py-3"><p className="font-medium">{skill.title}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{skill.slug ? `/${skill.slug}` : skill.id}</p></td>
                  <td className="px-4 py-3">{skillKind === 'SYSTEM' ? skill.aiSpace : <><p>{skill.createdBy?.name ?? '未知用户'}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{skill.createdBy?.unifiedCode ?? '-'}</p></>}</td>
                  <td className="px-4 py-3">{skill.lifecycleStatus ?? '未确认'}</td>
                  <td className="px-4 py-3">{(skill as AiSkillLibraryItem & { version?: number }).version ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{skill.source ?? '-'}</td>
                  {skillKind === 'SYSTEM' && <><td className="px-4 py-3"><SwitchButton checked={skill.visibleToUsers === true} disabled={busy === skill.id || skill.lifecycleStatus !== 'PUBLISHED'} label="用户侧展示" onChange={(checked) => void run(skill.id, () => updateAiSkillPresentation(skill.id, { visibleToUsers: checked, ...(checked ? {} : { defaultPinnedForUsers: false }) }), checked ? '已在用户侧展示' : '已从用户侧隐藏')} /></td><td className="px-4 py-3"><SwitchButton checked={skill.defaultPinnedForUsers === true} disabled={busy === skill.id || !skill.visibleToUsers || skill.lifecycleStatus !== 'PUBLISHED'} label="默认固定" onChange={(checked) => void run(skill.id, () => updateAiSkillPresentation(skill.id, { defaultPinnedForUsers: checked }), checked ? '已设为用户默认 Skill' : '已取消默认固定')} /></td></>}
                  <td className="px-4 py-3">{skill.lifecycleStatus === 'ARCHIVED' ? '已归档' : skill.active === false ? '停用' : '可用'}</td>
                  <td className="px-5 py-3"><div className="flex justify-end gap-2"><button className={secondaryButton} onClick={() => setSelected(skill)} type="button">详情</button><button className={secondaryButton} disabled={busy === skill.id || skill.lifecycleStatus === 'ARCHIVED'} onClick={() => void run(skill.id, () => setAiSkillActive(skill.id, skill.active === false), skill.active === false ? 'Skill 已启用' : 'Skill 已停用')} type="button">{skill.active === false ? '启用' : '停用'}</button><button className={dangerButton} disabled={busy === skill.id || skill.lifecycleStatus === 'ARCHIVED'} onClick={() => { if (window.confirm(`确认归档 ${skill.title}？`)) void run(skill.id, () => deleteAiSkill(skill.id), 'Skill 已归档') }} type="button">归档</button></div></td>
                </tr>
              ))}
              {!visible.length && <tr><td className="px-5 py-10 text-center text-slate-500 dark:text-slate-400" colSpan={skillKind === 'SYSTEM' ? 9 : 7}>没有符合条件的 Skill</td></tr>}
            </tbody>
          </table>
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
  return <button aria-label={label} aria-pressed={checked} className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`} disabled={disabled} onClick={() => onChange(!checked)} type="button"><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} /></button>
}

function SkillEditorDialog({ creating, onClose, onSave, skill }: { creating: boolean; onClose: () => void; onSave: (title: string, content: string) => Promise<void>; skill: AiSkillLibraryItem | null }) {
  const [title, setTitle] = useState(skill?.title ?? '')
  const [content, setContent] = useState(skill?.content ?? '')
  const editable = creating || ['DRAFT', 'ACTIVE_PRIVATE', 'CHANGES_REQUESTED', 'REJECTED'].includes(skill?.lifecycleStatus ?? '')
  return createPortal(<div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="presentation"><section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-[var(--app-surface)] text-slate-950 shadow-2xl ring-1 ring-black/10 dark:text-white dark:ring-white/10" role="dialog" aria-modal="true"><header className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10"><div><h3 className="text-base font-semibold">{creating ? '新建 Skill' : 'Skill 详情'}</h3>{skill && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{skill.lifecycleStatus} · {skill.aiSpace} · {skill.slug ?? skill.id}</p>}</div><button className={secondaryButton} onClick={onClose} type="button">关闭</button></header><div className="min-h-0 flex-1 overflow-y-auto p-5"><label className="block text-xs font-medium">名称<input className={`${inputClass} mt-1.5 w-full`} disabled={!editable} onChange={(event) => setTitle(event.target.value)} value={title} /></label><label className="mt-4 block text-xs font-medium">SKILL.md 内容<textarea className={`${inputClass} mt-1.5 min-h-80 w-full resize-y font-mono text-xs leading-6`} disabled={!editable} onChange={(event) => setContent(event.target.value)} value={content} /></label></div>{editable && <footer className="flex justify-end border-t border-black/10 px-5 py-4 dark:border-white/10"><button className={primaryButton} disabled={!title.trim() || !content.trim()} onClick={() => void onSave(title.trim(), content)} type="button">保存</button></footer>}</section></div>, document.body)
}

const inputClass = 'min-w-0 rounded-lg border border-black/10 bg-[var(--app-surface)] px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-white dark:placeholder:text-slate-500'
const primaryButton = 'rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton = 'rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 disabled:opacity-50'
const dangerButton = 'rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400 disabled:opacity-50'
