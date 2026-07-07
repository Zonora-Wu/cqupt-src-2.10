import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}

export function SearchInput({ value, onChange, placeholder = '搜索…', label }: SearchInputProps) {
  return (
    <label className="block">
      {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <div className={`flex items-center gap-3 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm transition focus-within:border-brand-600/60 focus-within:ring-1 focus-within:ring-brand-600/40 dark:border-white/10  ${label ? 'mt-2' : ''}`}>
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type="text"
          value={value}
        />
      </div>
    </label>
  )
}
