import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { AiSkillLibraryItem } from '../../services/ai'

export type SkillComposerEditorHandle = {
  clearText: () => void
  focus: () => void
  setSkills: (skills: AiSkillLibraryItem[]) => void
}

type SkillComposerEditorProps = {
  disabled?: boolean
  onChange: (text: string) => void
  onSkillsChange: (skillIds: string[]) => void
  onSubmit: () => void
  placeholder: string
}

export const SkillComposerEditor = forwardRef<SkillComposerEditorHandle, SkillComposerEditorProps>(function SkillComposerEditor({
  disabled,
  onChange,
  onSkillsChange,
  onSubmit,
  placeholder,
}, forwardedRef) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const readState = () => {
    const editor = editorRef.current
    if (!editor) return
    const clone = editor.cloneNode(true) as HTMLDivElement
    clone.querySelectorAll('[data-skill-id]').forEach((node) => node.remove())
    onChange(clone.innerText.replace(/\u200B/g, ''))
    onSkillsChange(Array.from(editor.querySelectorAll<HTMLElement>('[data-skill-id]')).map((node) => node.dataset.skillId ?? '').filter(Boolean))
  }

  const rememberRange = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange()
  }

  const removeSkill = (skillId: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.querySelector(`[data-skill-id="${CSS.escape(skillId)}"]`)?.remove()
    readState()
  }

  const insertSkill = (skill: AiSkillLibraryItem) => {
    const editor = editorRef.current
    if (!editor || editor.querySelector(`[data-skill-id="${CSS.escape(skill.id)}"]`)) return

    const chip = document.createElement('span')
    chip.contentEditable = 'false'
    chip.dataset.skillId = skill.id
    chip.className = 'mx-0.5 inline-flex items-center gap-1 rounded-md border border-brand-600/25 bg-brand-600/10 px-2 py-0.5 align-middle text-xs font-semibold text-brand-800 dark:text-brand-200'
    chip.append(document.createTextNode(skill.title))
    const remove = document.createElement('span')
    remove.dataset.removeSkill = skill.id
    remove.className = 'cursor-pointer text-brand-700/70 hover:text-red-600 dark:text-brand-200/70'
    remove.setAttribute('aria-label', `移除 ${skill.title}`)
    remove.textContent = '×'
    chip.append(remove)

    const range = savedRangeRef.current && editor.contains(savedRangeRef.current.commonAncestorContainer)
      ? savedRangeRef.current
      : document.createRange()
    if (!savedRangeRef.current || !editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    range.deleteContents()
    range.insertNode(chip)
    const spacer = document.createTextNode('\u200B')
    chip.after(spacer)
    range.setStartAfter(spacer)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
    editor.focus()
    readState()
  }

  useImperativeHandle(forwardedRef, () => ({
    clearText: () => {
      const editor = editorRef.current
      if (!editor) return
      Array.from(editor.childNodes).forEach((node) => {
        if (!(node instanceof HTMLElement) || !node.dataset.skillId) node.remove()
      })
      onChange('')
    },
    focus: () => editorRef.current?.focus(),
    setSkills: (skills) => {
      const desiredIds = new Set(skills.map((skill) => skill.id))
      editorRef.current?.querySelectorAll<HTMLElement>('[data-skill-id]').forEach((node) => {
        if (!desiredIds.has(node.dataset.skillId ?? '')) node.remove()
      })
      skills.forEach(insertSkill)
      readState()
    },
  }))

  return (
    <div
      aria-label="消息输入框"
      className="ai-chat-input-scroll min-h-12 max-h-[50vh] flex-1 overflow-y-auto bg-transparent px-2 py-3 text-sm leading-6 text-slate-900 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] dark:text-white dark:empty:before:text-white/30"
      contentEditable={!disabled}
      data-placeholder={placeholder}
      onClick={(event) => {
        const target = event.target as HTMLElement
        const skillId = target.dataset.removeSkill
        if (skillId) {
          event.preventDefault()
          removeSkill(skillId)
        }
      }}
      onInput={() => {
        rememberRange()
        readState()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          onSubmit()
        }
      }}
      onKeyUp={rememberRange}
      onMouseUp={rememberRange}
      ref={editorRef}
      role="textbox"
      suppressContentEditableWarning
    />
  )
})
