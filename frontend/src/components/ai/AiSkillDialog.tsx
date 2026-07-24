import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createAiSkill,
  deleteAiSkill,
  getAiSkills,
  submitAiSkill,
  uploadAiSkill,
  type AiSkillLibraryItem,
} from '../../services/ai'

export function AiSkillDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [skills, setSkills] = useState<AiSkillLibraryItem[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const reload = () => getAiSkills().then((result) => setSkills(result.skills))
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
      setTitle('')
      setContent('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-modal="true" className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900" role="dialog">
        <header className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
          <div><h2 className="text-lg font-semibold">Skill</h2><p className="mt-1 text-xs text-slate-500">私有 Skill 可立即使用，申请公开后由管理员人工审核。</p></div>
          <button aria-label="关闭" className="px-2 py-1 text-xl text-slate-500" onClick={onClose} type="button">×</button>
        </header>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-sm font-semibold">我的与平台 Skill</h3>
            <div className="mt-3 space-y-2">
              {skills.map((skill) => <div className="rounded-lg border border-black/10 p-3 dark:border-white/10" key={skill.id}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{skill.title}</p><p className="mt-1 text-xs text-slate-500">{skill.lifecycleStatus ?? 'PUBLISHED'}{skill.slug ? ` · /${skill.slug}` : ''}</p></div>
                  {skill.owned && <button className="text-xs text-red-600" disabled={busy} onClick={() => void run(() => deleteAiSkill(skill.id), 'Skill 已归档')} type="button">删除</button>}
                </div>
                {skill.owned && ['ACTIVE_PRIVATE', 'CHANGES_REQUESTED', 'REJECTED'].includes(skill.lifecycleStatus ?? '') && <button className="mt-3 rounded-lg border border-black/10 px-3 py-1.5 text-xs dark:border-white/10" disabled={busy} onClick={() => void run(() => submitAiSkill(skill.id), '已提交人工审核')} type="button">申请公开</button>}
              </div>)}
              {!skills.length && <p className="text-sm text-slate-500">暂无可用 Skill</p>}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">创建声明式 Skill</h3>
            <label className="mt-3 block text-xs font-medium">名称<input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="mt-3 block text-xs font-medium">SKILL.md 内容<textarea className={`${inputClass} min-h-48 resize-y`} value={content} onChange={(event) => setContent(event.target.value)} /></label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={primaryButton} disabled={busy || !title.trim() || !content.trim()} onClick={() => void run(() => createAiSkill({ content, title }), '私有 Skill 已创建')} type="button">创建</button>
              <button className={secondaryButton} disabled={busy} onClick={() => fileRef.current?.click()} type="button">上传 SKILL.md / ZIP</button>
              <input accept=".md,.zip" className="hidden" ref={fileRef} type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => uploadAiSkill(file), 'Skill 包已导入') }} />
            </div>
            {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-600 dark:border-white/15'
const primaryButton = 'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton = 'rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium dark:border-white/15'
