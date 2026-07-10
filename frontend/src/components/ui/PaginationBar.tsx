import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type PaginationBarProps = {
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  total: number
}

export function PaginationBar({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  total,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = clamp(page, 1, totalPages)
  const [jumpPage, setJumpPage] = useState(String(safePage))

  useEffect(() => {
    setJumpPage(String(safePage))
  }, [safePage])

  const pages = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages])
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(total, safePage * pageSize)

  const go = (nextPage: number) => {
    onPageChange(clamp(nextPage, 1, totalPages))
  }

  const submitJump = () => {
    const parsed = Number.parseInt(jumpPage, 10)
    if (Number.isNaN(parsed)) {
      setJumpPage(String(safePage))
      return
    }
    go(parsed)
  }

  return (
    <div className="flex flex-col gap-3 border-t border-black/10 px-4 py-3 text-sm dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>
          第 <strong className="font-semibold text-slate-800 dark:text-slate-100">{safePage}</strong> / {totalPages} 页
        </span>
        <span>
          当前 {start}-{end} 条，共 {total} 条
        </span>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-2">
            <span>每页</span>
            <select
              className="rounded-md border border-black/10 bg-[var(--app-panel-bg)] px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-brand-600/60 dark:border-white/10 dark:text-slate-200"
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={pageSize}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>条</span>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PageIconButton disabled={safePage <= 1} label="第一页" onClick={() => go(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </PageIconButton>
        <PageIconButton disabled={safePage <= 1} label="上一页" onClick={() => go(safePage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </PageIconButton>

        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((item, index) =>
            item === 'ellipsis' ? (
              <span className="px-1 text-xs text-slate-400" key={`ellipsis-${index}`}>
                ...
              </span>
            ) : (
              <button
                className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition ${
                  item === safePage
                    ? 'bg-brand-600 text-white'
                    : 'border border-black/10 text-slate-600 hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
                key={item}
                onClick={() => go(item)}
                type="button"
              >
                {item}
              </button>
            ),
          )}
        </div>

        <PageIconButton disabled={safePage >= totalPages} label="下一页" onClick={() => go(safePage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </PageIconButton>
        <PageIconButton disabled={safePage >= totalPages} label="最后一页" onClick={() => go(totalPages)}>
          <ChevronsRight className="h-4 w-4" />
        </PageIconButton>

        <label className="ml-0 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 sm:ml-2">
          <span>跳至</span>
          <input
            className="h-8 w-16 rounded-md border border-black/10 bg-[var(--app-panel-bg)] px-2 text-center text-xs text-slate-700 outline-none transition focus:border-brand-600/60 dark:border-white/10 dark:text-slate-200"
            min={1}
            onChange={(event) => setJumpPage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitJump()
            }}
            type="number"
            value={jumpPage}
          />
          <span>页</span>
        </label>
        <button
          className="h-8 rounded-md border border-black/10 px-3 text-xs font-semibold text-slate-600 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          onClick={submitJump}
          type="button"
        >
          跳转
        </button>
      </div>
    </div>
  )
}

function PageIconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/10 text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

function buildPageItems(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const items: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) items.push('ellipsis')
  for (let item = start; item <= end; item += 1) items.push(item)
  if (end < totalPages - 1) items.push('ellipsis')
  items.push(totalPages)

  return items
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
