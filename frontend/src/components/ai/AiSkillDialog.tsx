import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createAiSkill,
  deleteAiSkill,
  getAiSkills,
  isUsableAiSkill,
  submitAiSkill,
  updateAiSkill,
  uploadAiSkill,
  type AiSkillLibraryItem,
} from '../../services/ai'

type AiSkillDialogProps = {
  activeSkillIds: string[]
  onActiveChange: (skillIds: string[]) => void
  onChanged: () => void
  onClose: () => void
  onPinnedChange: (skillIds: string[]) => void
  pinnedSkillIds: string[]
}

export function AiSkillDialog({
  activeSkillIds,
  onActiveChange,
  onChanged,
  onClose,
  onPinnedChange,
  pinnedSkillIds,
}: AiSkillDialogProps) {
  const [skills, setSkills] = useState<AiSkillLibraryItem[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [viewingSkill, setViewingSkill] = useState<AiSkillLibraryItem | null>(null)

  const reload = () => getAiSkills().then((result) => setSkills(result.skills.filter(isUsableAiSkill)))
  useEffect(() => {
    const timer = window.setTimeout(() => void reload().catch(() => setMessage('Skill 加载失败')), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await action()
      await reload()
      onChanged()
      setMessage(success)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败')
      return false
    } finally {
      setBusy(false)
    }
  }

  const togglePinned = (skillId: string) => {
    onPinnedChange(pinnedSkillIds.includes(skillId)
      ? pinnedSkillIds.filter((id) => id !== skillId)
      : [...pinnedSkillIds, skillId])
  }

  const toggleActive = (skillId: string) => {
    if (activeSkillIds.includes(skillId)) {
      onActiveChange(activeSkillIds.filter((id) => id !== skillId))
      return
    }
    if (activeSkillIds.length >= 3) {
      setMessage('一次最多使用 3 个 Skill')
      return
    }
    onActiveChange([...activeSkillIds, skillId])
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/45 p-0 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
        <section aria-modal="true" className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[var(--app-surface)] text-slate-950 shadow-2xl dark:text-white sm:h-auto sm:max-h-[88vh] sm:rounded-lg sm:border sm:border-black/10 dark:sm:border-white/10" role="dialog">
          <header className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10">
            <div><h2 className="text-lg font-semibold">Skill 管理</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">选择本次对话使用的 Skill，并将常用 Skill 固定到输入框上方。</p></div>
            <div className="flex items-center gap-2">
              <button className={primaryButton} onClick={() => setAddOpen(true)} type="button"><Plus className="h-4 w-4" />添加 Skill</button>
              <button aria-label="关闭" className={iconButton} onClick={onClose} type="button"><X className="h-5 w-5" /></button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <button
                aria-pressed={!activeSkillIds.length}
                className={skillTileClass(!activeSkillIds.length)}
                onClick={() => onActiveChange([])}
                type="button"
              >
                <span className="text-sm font-semibold">自动选择</span>
              </button>
              {skills.map((skill) => (
                <div className={skillTileClass(activeSkillIds.includes(skill.id))} key={skill.id}>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setViewingSkill(skill)} type="button">
                    <span className="block truncate text-sm font-semibold">{skill.title}</span>
                  </button>
                  <button className={smallButton} onClick={() => toggleActive(skill.id)} type="button">
                    {activeSkillIds.includes(skill.id) ? '已使用' : '使用'}
                  </button>
                  <button
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${pinnedSkillIds.includes(skill.id) ? 'bg-brand-600 text-white' : 'bg-black/5 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}
                    onClick={() => togglePinned(skill.id)}
                    type="button"
                  >
                    {pinnedSkillIds.includes(skill.id) ? '已固定' : '固定'}
                  </button>
                </div>
              ))}
            </div>
            {!skills.length && <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无可用 Skill</p>}
            {message && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
          </div>
        </section>
      </div>
      {addOpen && <AddSkillDialog busy={busy} onClose={() => setAddOpen(false)} onRun={run} />}
      {viewingSkill && <SkillContentDialog busy={busy} onClose={() => setViewingSkill(null)} onRun={run} skill={viewingSkill} />}
    </>,
    document.body,
  )
}

function SkillContentDialog({ busy, onClose, onRun, skill }: { busy: boolean; onClose: () => void; onRun: (action: () => Promise<unknown>, success: string) => Promise<boolean>; skill: AiSkillLibraryItem }) {
  const [title, setTitle] = useState(skill.title)
  const [content, setContent] = useState(skill.content)
  const editable = skill.owned === true && ['DRAFT', 'ACTIVE_PRIVATE', 'CHANGES_REQUESTED', 'REJECTED'].includes(skill.lifecycleStatus ?? '')
  const canSubmit = skill.owned === true && ['ACTIVE_PRIVATE', 'CHANGES_REQUESTED', 'REJECTED'].includes(skill.lifecycleStatus ?? '')
  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-modal="true" className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-[var(--app-surface)] text-slate-950 shadow-2xl ring-1 ring-black/10 dark:text-white dark:ring-white/10" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{skill.title}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{editable ? '我的私有 Skill · 可编辑' : '平台公开 Skill · 只读查看'}</p>
          </div>
          <button aria-label="关闭" className={iconButton} onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {editable ? (
            <>
              <label className="block text-xs font-medium">名称<input autoComplete="off" className={inputClass} maxLength={80} onChange={(event) => setTitle(event.target.value)} value={title} /></label>
              <label className="mt-4 block text-xs font-medium">SKILL.md 内容<textarea className={`${inputClass} min-h-72 resize-y font-mono text-xs leading-6`} maxLength={30000} onChange={(event) => setContent(event.target.value)} value={content} /></label>
            </>
          ) : <pre className="whitespace-pre-wrap break-words rounded-lg border border-black/10 bg-black/[0.025] p-4 font-mono text-xs leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">{skill.content}</pre>}
        </div>
        {skill.owned && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-5 py-4 dark:border-white/10">
            <button className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300" disabled={busy} onClick={async () => { if (await onRun(() => deleteAiSkill(skill.id), 'Skill 已归档')) onClose() }} type="button">删除 Skill</button>
            <div className="flex flex-wrap justify-end gap-2">
              {canSubmit && <button className={secondaryButton} disabled={busy} onClick={async () => { if (await onRun(() => submitAiSkill(skill.id), '已提交人工审核')) onClose() }} type="button">申请公开</button>}
              {editable && <button className={primaryButton} disabled={busy || !title.trim() || !content.trim()} onClick={async () => { if (await onRun(() => updateAiSkill(skill.id, { content: content.trim(), title: title.trim() }), 'Skill 已更新')) onClose() }} type="button">保存修改</button>}
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}

function AddSkillDialog({ busy, onClose, onRun }: { busy: boolean; onClose: () => void; onRun: (action: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-modal="true" className="w-full max-w-2xl rounded-lg bg-[var(--app-surface)] text-slate-950 shadow-2xl ring-1 ring-black/10 dark:text-white dark:ring-white/10" role="dialog">
        <header className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-semibold">添加 Skill</h3>
          <button aria-label="关闭" className={iconButton} onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5">
          <label className="block text-xs font-medium">名称<input autoComplete="off" className={inputClass} maxLength={80} placeholder="必填，填写 Skill 名称" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="mt-4 block text-xs font-medium">SKILL.md 内容<textarea className={`${inputClass} min-h-52 resize-y`} maxLength={30000} placeholder="必填，填写声明式 Skill 内容" value={content} onChange={(event) => setContent(event.target.value)} /></label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button className={secondaryButton} disabled={busy} onClick={() => fileRef.current?.click()} type="button">上传 SKILL.md / ZIP</button>
            <input accept=".md,.zip" className="hidden" ref={fileRef} type="file" onChange={async (event) => { const file = event.target.files?.[0]; if (file && await onRun(() => uploadAiSkill(file), 'Skill 包已导入')) onClose() }} />
            <button className={primaryButton} disabled={busy || !title.trim() || !content.trim()} onClick={async () => { if (await onRun(() => createAiSkill({ content, title }), '私有 Skill 已创建')) onClose() }} type="button"><Plus className="h-4 w-4" />创建 Skill</button>
          </div>
        </div>
      </section>
    </div>
  )
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--app-surface)] px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600/25 dark:border-white/15 dark:text-white dark:placeholder:text-slate-500'
const primaryButton = 'inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton = 'rounded-lg border border-black/10 px-3 py-2 text-sm font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10'
const smallButton = 'text-xs font-medium text-brand-700 dark:text-brand-300'
const iconButton = 'grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
const skillTileClass = (active: boolean) => `flex min-h-16 flex-wrap items-center gap-2 rounded-lg border p-3 text-left transition ${active ? 'border-brand-600 bg-brand-600/5 text-brand-800 dark:bg-brand-400/10 dark:text-brand-200' : 'border-black/10 hover:border-brand-600/40 dark:border-white/10'}`
