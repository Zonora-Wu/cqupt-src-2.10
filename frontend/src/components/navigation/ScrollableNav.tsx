import { useRef } from 'react'

type ScrollableNavProps = {
  activeItem: string
  badges?: Record<string, number>
  className?: string
  items: string[]
  mobile?: boolean
  onChange: (item: string) => void
}

export function ScrollableNav({
  activeItem,
  badges = {},
  className = '',
  items,
  mobile = false,
  onChange,
}: ScrollableNavProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  return (
    <nav
      className={`${mobile ? 'block' : 'mx-auto hidden max-w-full items-center justify-center overflow-hidden md:flex'} ${className}`}
      onWheel={(event) => {
        const element = scrollRef.current
        if (!element || element.scrollWidth <= element.clientWidth) return

        event.preventDefault()
        element.scrollLeft += event.deltaY || event.deltaX
      }}
    >
      <div
        className="relative z-10 max-w-full overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={scrollRef}
      >
        <div className={mobile ? 'flex w-max gap-2' : 'flex w-max items-center justify-center gap-7 px-1'}>
          {items.map((item) => (
            <button
              className={
                mobile
                  ? `shrink-0 rounded-md px-3 py-1.5 text-sm ${
                      activeItem === item ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`
                  : `shrink-0 text-sm font-medium transition hover:text-brand-700 dark:hover:text-brand-300 ${
                      activeItem === item
                        ? 'text-brand-700 dark:text-brand-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`
              }
              key={item}
              onClick={() => onChange(item)}
              type="button"
            >
              <span className="relative inline-flex items-center">
                {item}
                {(badges[item] ?? 0) > 0 && (
                  <span aria-label={`${item}有未读通知`} className="absolute -right-2 -top-0.5 z-20 h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
