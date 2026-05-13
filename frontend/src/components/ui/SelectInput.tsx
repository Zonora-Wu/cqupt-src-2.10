import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

type SelectInputProps = {
  label: string
  onChange?: (value: string) => void
  options: string[]
  placeholder?: string
  value?: string
}

export function SelectInput({
  label,
  onChange,
  options,
  placeholder = '请选择',
  value: controlledValue,
}: SelectInputProps) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState('')
  const value = controlledValue ?? internalValue

  const selectValue = (nextValue: string) => {
    setInternalValue(nextValue)
    onChange?.(nextValue)
    setOpen(false)
  }

  return (
    <label className="relative block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <button
        className="mt-2 flex w-full items-center justify-between rounded-lg border border-black/10 bg-white/95 px-3 py-3 text-left text-sm text-slate-900 outline-none transition hover:bg-white focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={value ? '' : 'text-slate-400 dark:text-white/30'}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-2 overflow-hidden rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-1 shadow-xl dark:border-white/10 dark:bg-[#0f1511]/95">
          {options.map((option) => (
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition ${
                value === option
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-700 hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
              key={option}
              onClick={() => selectValue(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </label>
  )
}
