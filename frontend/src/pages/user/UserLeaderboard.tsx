import { Medal, Trophy, UserRound } from 'lucide-react'
import { useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

const tabs = ['总榜', '本月', '本周']

const ranks = [
  { rank: 1, name: '星火同学', points: 4860, reports: 18 },
  { rank: 2, name: '南山同学', points: 3920, reports: 15 },
  { rank: 3, name: '青藤同学', points: 3480, reports: 13 },
  { rank: 4, name: '白盒同学', points: 2840, reports: 11 },
  { rank: 5, name: '回显同学', points: 2360, reports: 9 },
  { rank: 6, name: '令牌同学', points: 2120, reports: 8 },
  { rank: 12, name: '学生用户', points: 1260, reports: 5, current: true },
]

const topRanks = [ranks[1], ranks[0], ranks[2]]
const restRanks = ranks.slice(3)

function medalClass(rank: number) {
  if (rank === 1) return 'bg-amber-400 text-slate-950'
  if (rank === 2) return 'bg-slate-300 text-slate-900'
  return 'bg-orange-400 text-white'
}

export function UserLeaderboard() {
  const [activeTab, setActiveTab] = useState('总榜')

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
                activeTab === tab
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {topRanks.map((item) => (
          <SurfacePanel className={`p-6 text-center ${item.rank === 1 ? 'md:-mt-4' : 'md:mt-6'}`} key={item.rank}>
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-lg text-lg font-semibold ${medalClass(item.rank)}`}>
              {item.rank}
            </div>
            <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
              {item.rank === 1 ? <Trophy className="h-6 w-6" /> : <UserRound className="h-6 w-6" />}
            </div>
            <h2 className="mt-5 text-xl font-semibold">{item.name}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.reports} 个有效漏洞</p>
            <p className="mt-5 text-3xl font-semibold text-brand-700 dark:text-green-300">{item.points}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">贡献积分</p>
          </SurfacePanel>
        ))}
      </div>

      <SurfacePanel className="mt-8 overflow-hidden p-0">
        {restRanks.map((item) => (
          <div
            className={`flex items-center justify-between gap-4 border-b border-black/5 px-5 py-4 last:border-b-0 dark:border-white/10 ${
              item.current ? 'bg-brand-600/8 dark:bg-green-300/8' : ''
            }`}
            key={item.rank}
          >
            <div className="flex min-w-0 items-center gap-4">
              <span className="w-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">{item.rank}</span>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.reports} 个有效漏洞</p>
              </div>
            </div>
            <span className="font-semibold text-brand-700 dark:text-green-300">{item.points}</span>
          </div>
        ))}
      </SurfacePanel>
    </PageSection>
  )
}
