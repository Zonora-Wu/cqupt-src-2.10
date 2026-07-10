import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

type CopyableCodeProps = {
  value: string
}

export function CopyableCode({ value }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const Icon = copied ? Check : Copy

  return (
    <button
      aria-label={copied ? `已复制编号 ${value}` : `复制编号 ${value}`}
      className={`group inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs font-semibold transition ${
        copied
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-black/10 text-slate-700 hover:border-brand-600/30 hover:bg-brand-600/10 hover:text-brand-800 dark:border-white/10 dark:text-slate-200 dark:hover:text-brand-300'
      }`}
      onClick={() => void copy()}
      title={copied ? '已复制' : '点击复制编号'}
      type="button"
    >
      <span className="whitespace-nowrap">{value}</span>
      <Icon className="h-3 w-3 shrink-0 opacity-70 transition group-hover:opacity-100" />
    </button>
  )
}
