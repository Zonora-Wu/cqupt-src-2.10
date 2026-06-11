import { Medal, Trophy, UserRound } from 'lucide-react'
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

function medalClass(rank: number) {
  if (rank === 1) return 'bg-amber-400 text-slate-950'
  if (rank === 2) return 'bg-slate-300 text-slate-900'
  return 'bg-orange-400 text-white'
}

export function UserLeaderboard() {
  const [activeScope, setActiveScope] = useState<LeaderboardScope>('all')
  const [items, setItems] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getLeaderboard(activeScope)
      .then((data) => setItems(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '排行榜加载失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [activeScope])

  const top3 = items.slice(0, 3)
  // 展示顺序：2 1 3（视觉上 1 居中更高）
  const topDisplay: Array<LeaderboardEntry | undefined> =
    top3.length >= 3
      ? [top3[1], top3[0], top3[2]]
      : top3.length === 2
        ? [top3[1], top3[0], undefined]
        : [undefined, top3[0], undefined]
  const restItems = items.slice(3)

  return (
    <PageSection size="sm">
      <div className="text-center">
        <PageHeader
          eyebrow="Leaderboard"
          eyebrowIcon={<Medal className="h-3.5 w-3.5" />}
          title="排行榜"
          description="展示校园安全贡献排名，仅用于学习激励。"
          align="center"
        />
      </div>

      <div className="mt-7 flex justify-center">
        <div className="inline-flex rounded-lg border border-black/10 bg-white/60 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
          {tabs.map((tab) => (
            <button
              className={`rounded-md px-5 py-2 text-sm font-medium transition ${
                activeScope === tab.scope
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
              key={tab.scope}
              onClick={() => setActiveScope(tab.scope)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">加载中...</div>
      )}

      {!loading && error && (
        <AlertMessage className="mt-10" message={error} onClose={() => setError('')} variant="error" />
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">
          {activeScope === 'week' ? '本周' : activeScope === 'month' ? '本月' : ''}暂无积分数据
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {topDisplay.map((item, index) => {
              if (!item) return <div key={index} />
              return (
                <SurfacePanel
                  className={`p-6 text-center ${item.rank === 1 ? 'md:-mt-4' : 'md:mt-6'} ${item.isCurrent ? 'ring-2 ring-brand-500' : ''}`}
                  key={item.id}
                >
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-lg text-lg font-semibold ${medalClass(item.rank)}`}>
                    {item.rank}
                  </div>
                  <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                    {item.rank === 1 ? <Trophy className="h-6 w-6" /> : <UserRound className="h-6 w-6" />}
                  </div>
                  <h2 className="mt-5 text-xl font-semibold">
                    {item.name}
                    {item.isCurrent && <span className="ml-2 text-xs text-brand-600 dark:text-green-400">（我）</span>}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.reports} 个有效漏洞</p>
                  <p className="mt-5 text-3xl font-semibold text-brand-700 dark:text-green-300">{item.score}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">贡献积分</p>
                </SurfacePanel>
              )
            })}
          </div>

          {restItems.length > 0 && (
            <SurfacePanel className="mt-8 overflow-hidden p-0">
              {restItems.map((item) => (
                <div
                  className={`flex items-center justify-between gap-4 border-b border-black/5 px-5 py-4 last:border-b-0 dark:border-white/10 ${
                    item.isCurrent ? 'bg-brand-600/8 dark:bg-green-300/8' : ''
                  }`}
                  key={item.id}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="w-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">{item.rank}</span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {item.name}
                        {item.isCurrent && <span className="ml-2 text-xs text-brand-600 dark:text-green-400">（我）</span>}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.reports} 个有效漏洞</p>
                    </div>
                  </div>
                  <span className="font-semibold text-brand-700 dark:text-green-300">{item.score}</span>
                </div>
              ))}
            </SurfacePanel>
          )}
        </>
      )}
    </PageSection>
  )
}
