import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export type SelectOption = string | { label: string; value: string }

type SelectInputProps = {
  className?: string
  icon?: ReactNode
  label?: string
  onChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  value?: string
}

export function SelectInput({
  className = '',
  icon,
  label,
  onChange,
  options,
  placeholder = '请选择',
  value: controlledValue,
}: SelectInputProps) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState('')
  const rootRef = useRef<HTMLLabelElement | null>(null)
  const value = controlledValue ?? internalValue
  const normalizedOptions = options.map((option) => typeof option === 'string' ? { label: option, value: option } : option)
  const selectedLabel = normalizedOptions.find((option) => option.value === value)?.label ?? value

  const selectValue = (nextValue: string) => {
    setInternalValue(nextValue)
    onChange?.(nextValue)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <label className={`relative block ${className}`} ref={rootRef}>
      {label ? <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span> : null}
      <button
        className={`${label ? 'mt-2' : ''} flex w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-left text-sm text-slate-900 outline-none transition hover:bg-white focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 dark:text-white/35 [&>svg]:h-5 [&>svg]:w-5">{icon}</span> : null}
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-slate-400 dark:text-white/30'}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="select-dropdown-scrollbar absolute left-0 right-0 top-full z-[80] mt-2 max-h-72 overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-1 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
          {normalizedOptions.map((option) => (
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition ${
                value === option.value
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-700 hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
              key={option.value}
              onClick={() => selectValue(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </label>
  )
}
