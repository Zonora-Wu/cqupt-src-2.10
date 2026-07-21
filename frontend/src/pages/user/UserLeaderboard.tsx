import { useEffect, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { type LeaderboardEntry, type LeaderboardScope, getLeaderboard } from '../../services/leaderboard'

const tabs: Array<{ label: string; scope: LeaderboardScope }> = [
  { label: '总榜', scope: 'all' },
  { label: '本月', scope: 'month' },
  { label: '本周', scope: 'week' },
]

const scopeLabels: Record<LeaderboardScope, string> = {
  all: '累计贡献',
  month: '本月贡献',
  week: '本周贡献',
}

export function UserLeaderboard() {
  const [activeScope, setActiveScope] = useState<LeaderboardScope>('all')
  const [items, setItems] = useState<LeaderboardEntry[]>([])
  const [me, setMe] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getLeaderboard(activeScope)
      .then((data) => {
        if (!active) return
        setItems(data.items)
        setMe(data.me)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : '排行榜加载失败，请刷新重试')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeScope])

  const changeScope = (scope: LeaderboardScope) => {
    if (scope === activeScope) return
    setLoading(true)
    setError('')
    setActiveScope(scope)
  }

  return (
    <PageSection className="pb-6" size="md">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="安全贡献榜"
          description="按有效漏洞产生的贡献积分排名，商城兑换与其他积分不影响名次。"
        />
        <div
          aria-label="排行榜周期"
          className="grid w-full grid-cols-3 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-1 dark:border-white/10 md:w-auto"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-selected={activeScope === tab.scope}
              className={`min-w-20 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 ${
                activeScope === tab.scope
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/[0.07]'
              }`}
              key={tab.scope}
              onClick={() => changeScope(tab.scope)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div aria-busy={loading} aria-live="polite" className="mt-7 min-h-[360px]">
        {loading && <LeaderboardSkeleton />}

        {!loading && error && (
          <AlertMessage message={error} onClose={() => setError('')} variant="error" />
        )}

        {!loading && !error && (
          <div>
            <SurfacePanel className="overflow-hidden p-0">
              <div className="hidden grid-cols-[72px_minmax(240px,1fr)_150px_150px] items-center gap-4 border-b border-black/10 bg-[var(--app-panel-muted-bg)] px-6 py-3 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400 md:grid">
                <span className="text-center">排名</span>
                <span>用户</span>
                <span className="text-right">有效漏洞</span>
                <span className="text-right">贡献积分</span>
              </div>

              {items.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{scopeLabels[activeScope]}暂无排名</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">有效漏洞确认并发放积分后，将进入榜单。</p>
                </div>
              ) : (
                <div>
                  {items.map((item) => <LeaderboardRow item={item} key={item.id} />)}
                </div>
              )}
            </SurfacePanel>
          </div>
        )}
      </div>

      {!loading && !error && me && <MyRanking entry={me} scope={activeScope} />}
    </PageSection>
  )
}

function LeaderboardRow({ item }: { item: LeaderboardEntry }) {
  return (
    <div
      className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-black/[0.07] px-4 py-3.5 last:border-b-0 dark:border-white/[0.08] md:grid-cols-[72px_minmax(240px,1fr)_150px_150px] md:gap-4 md:px-6 ${
        item.isCurrent ? 'bg-brand-600/[0.07] dark:bg-brand-300/[0.07]' : ''
      }`}
    >
      <div className="flex justify-center">
        <RankMark rank={item.rank} />
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <LeaderboardAvatar avatarUrl={item.avatarUrl} name={item.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {item.name}
            {item.isCurrent && <span className="ml-2 text-xs font-medium text-brand-700 dark:text-brand-300">我</span>}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:hidden">{item.reports} 个有效漏洞</p>
        </div>
      </div>
      <span className="hidden text-right text-sm tabular-nums text-slate-600 dark:text-slate-300 md:block">{item.reports}</span>
      <div className="text-right">
        <span className="text-base font-semibold tabular-nums text-brand-700 dark:text-brand-300">{item.score}</span>
        <span className="ml-1 text-xs text-slate-400 md:hidden">分</span>
      </div>
    </div>
  )
}

function RankMark({ rank }: { rank: number | null }) {
  const highlighted = rank !== null && rank <= 3
  const color = rank === 1
    ? 'bg-amber-400 text-slate-950'
    : rank === 2
      ? 'bg-slate-300 text-slate-900 dark:bg-slate-400'
      : rank === 3
        ? 'bg-orange-500 text-white'
        : 'text-slate-500 dark:text-slate-400'

  return (
    <span className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-sm font-semibold tabular-nums ${color} ${highlighted ? 'shadow-sm' : ''}`}>
      {rank ?? '—'}
    </span>
  )
}

function LeaderboardAvatar({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false)

  if (avatarUrl && !failed) {
    return (
      <img
        alt={`${name}头像`}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10"
        onError={() => setFailed(true)}
        src={avatarUrl}
      />
    )
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600/12 text-sm font-semibold text-brand-800 ring-1 ring-brand-600/15 dark:bg-brand-300/12 dark:text-brand-200 dark:ring-brand-300/20">
      {name.trim().slice(0, 1) || '用'}
    </span>
  )
}

function MyRanking({ entry, scope }: { entry: LeaderboardEntry; scope: LeaderboardScope }) {
  return (
    <div className="sticky bottom-3 z-20 mt-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-brand-600/25 bg-[var(--app-header-bg)] px-4 py-3 shadow-lg backdrop-blur-xl dark:border-brand-300/20 md:grid-cols-[84px_minmax(0,1fr)_150px_150px] md:px-6">
        <div className="text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">我的排名</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">{entry.rank ? `#${entry.rank}` : '未上榜'}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{entry.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{scopeLabels[scope]}</p>
        </div>
        <div className="hidden text-right md:block">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">有效漏洞</p>
          <p className="mt-0.5 font-semibold tabular-nums">{entry.reports}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">贡献积分</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-brand-700 dark:text-brand-300">{entry.score}</p>
        </div>
      </div>
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <SurfacePanel className="overflow-hidden p-0">
      <div className="h-11 animate-pulse bg-[var(--app-panel-muted-bg)]" />
      {Array.from({ length: 7 }, (_, index) => (
        <div className="flex items-center gap-4 border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.07]" key={index}>
          <span className="h-7 w-7 animate-pulse rounded-md bg-black/[0.07] dark:bg-white/[0.08]" />
          <span className="h-10 w-10 animate-pulse rounded-full bg-black/[0.07] dark:bg-white/[0.08]" />
          <span className="h-4 flex-1 animate-pulse rounded bg-black/[0.07] dark:bg-white/[0.08]" />
          <span className="h-4 w-16 animate-pulse rounded bg-black/[0.07] dark:bg-white/[0.08]" />
        </div>
      ))}
    </SurfacePanel>
  )
}
