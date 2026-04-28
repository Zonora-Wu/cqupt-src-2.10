import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  Filter,
  Gift,
  History,
  PackageCheck,
  Printer,
  ShoppingBag,
  Sparkles,
  TicketCheck,
  Trophy,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

const categoryOptions = ['全部商品', '实体奖励', '学习权益', '证书周边']
const sortOptions = ['默认排序', '积分从低到高', '积分从高到低', '库存优先']

const mallStats = [
  { label: '当前积分', value: '1260', hint: '可用于兑换', icon: Trophy },
  { label: '可兑换', value: '5', hint: '库存充足商品', icon: Gift },
  { label: '已兑换', value: '3', hint: '历史申请', icon: PackageCheck },
  { label: '待处理', value: '1', hint: '兑换审核中', icon: Clock3 },
]

const products = [
  {
    id: 'mall-001',
    name: 'CQUPT-SRC 定制笔记本',
    category: '实体奖励',
    points: 280,
    stock: 18,
    description: '用于记录漏洞复现过程、学习笔记和靶场训练思路的定制笔记本。',
    tags: ['实物', '学习记录'],
    imageTone: 'from-emerald-100 via-white to-slate-100 dark:from-emerald-950/50 dark:via-white/[0.06] dark:to-slate-900',
    imageIcon: BookOpen,
    imageHeight: 'h-48',
  },
  {
    id: 'mall-002',
    name: '安全工具进阶资料包',
    category: '学习权益',
    points: 360,
    stock: 42,
    description: '包含常见 Web 测试工具配置说明、使用边界和报告模板。',
    tags: ['资料', '工具'],
    imageTone: 'from-blue-100 via-white to-emerald-50 dark:from-blue-950/45 dark:via-white/[0.06] dark:to-emerald-950/30',
    imageIcon: PackageCheck,
    imageHeight: 'h-56',
  },
  {
    id: 'mall-003',
    name: '漏洞证书精装打印服务',
    category: '证书周边',
    points: 520,
    stock: 12,
    description: '将已获得的高价值漏洞证书进行精装打印，适合个人成长档案留存。',
    tags: ['证书', '纪念'],
    imageTone: 'from-amber-100 via-white to-emerald-50 dark:from-amber-950/40 dark:via-white/[0.06] dark:to-emerald-950/25',
    imageIcon: Printer,
    imageHeight: 'h-52',
  },
  {
    id: 'mall-004',
    name: '专项靶场优先体验资格',
    category: '学习权益',
    points: 680,
    stock: 8,
    description: '提前体验权限控制、接口安全、日志分析等专项训练靶场。',
    tags: ['靶场', '训练'],
    imageTone: 'from-cyan-100 via-white to-emerald-50 dark:from-cyan-950/35 dark:via-white/[0.06] dark:to-emerald-950/30',
    imageIcon: Sparkles,
    imageHeight: 'h-60',
  },
  {
    id: 'mall-005',
    name: 'CQUPT-SRC 定制徽章',
    category: '实体奖励',
    points: 180,
    stock: 0,
    description: '面向有效漏洞贡献者的定制徽章，库存补充后可继续兑换。',
    tags: ['实物', '纪念'],
    imageTone: 'from-slate-100 via-white to-emerald-50 dark:from-slate-800 dark:via-white/[0.06] dark:to-emerald-950/25',
    imageIcon: Award,
    imageHeight: 'h-44',
  },
  {
    id: 'mall-006',
    name: '安全分享会预约名额',
    category: '学习权益',
    points: 900,
    stock: 5,
    description: '用于预约参与校内安全分享会，与审核员和优秀同学交流报告经验。',
    tags: ['交流', '成长'],
    imageTone: 'from-violet-100 via-white to-emerald-50 dark:from-violet-950/35 dark:via-white/[0.06] dark:to-emerald-950/25',
    imageIcon: TicketCheck,
    imageHeight: 'h-56',
  },
]

const categoryStyles: Record<string, string> = {
  实体奖励: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  学习权益: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  证书周边: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export function UserPointsMall() {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部商品')
  const [sort, setSort] = useState('默认排序')
  const userPoints = 1260

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    const result = products.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword))
      const matchesCategory = category === '全部商品' || item.category === category

      return matchesKeyword && matchesCategory
    })

    if (sort === '积分从低到高') return [...result].sort((a, b) => a.points - b.points)
    if (sort === '积分从高到低') return [...result].sort((a, b) => b.points - a.points)
    if (sort === '库存优先') return [...result].sort((a, b) => b.stock - a.stock)

    return result
  }, [category, keyword, sort])

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="Points Mall"
          eyebrowIcon={<ShoppingBag className="h-3.5 w-3.5" />}
          title="积分商城"
          description="使用漏洞贡献积分兑换学习资料、训练权益和纪念奖励。兑换通过后在校内线下领取，不提供邮寄。"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          type="button"
        >
          <History className="h-4 w-4" />
          查看兑换记录
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {mallStats.map((item) => {
          const Icon = item.icon
          return (
            <SurfacePanel className="p-5" key={item.label}>
              <div className="flex items-start justify-between gap-4">
                <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                <span className="text-3xl font-semibold">{item.value}</span>
              </div>
              <p className="mt-3 text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
            </SurfacePanel>
          )
        })}
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
          <SearchInput
            label="搜索商品"
            onChange={setKeyword}
            placeholder="输入商品、权益或标签"
            value={keyword}
          />
          <SelectInput label="商品类型" onChange={setCategory} options={categoryOptions} value={category} />
          <SelectInput label="排序方式" onChange={setSort} options={sortOptions} value={sort} />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => {
              setKeyword('')
              setCategory('全部商品')
              setSort('默认排序')
            }}
            type="button"
          >
            <Filter className="h-4 w-4" />
            重置
          </button>
        </div>
      </SurfacePanel>

      <div className="mt-6 columns-1 gap-5 md:columns-2 xl:columns-3">
        {filteredProducts.map((item) => {
          const canExchange = item.stock > 0 && userPoints >= item.points
          const disabledReason = item.stock <= 0 ? '库存不足' : '积分不足'
          const ImageIcon = item.imageIcon

          return (
            <SurfacePanel
              className="mb-5 inline-block w-full break-inside-avoid overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]"
              key={item.id}
            >
              <div className="flex flex-col">
                <div className={`relative ${item.imageHeight} overflow-hidden bg-gradient-to-br ${item.imageTone}`}>
                  <div className="absolute inset-5 rounded-lg border border-white/70 bg-white/35 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.05]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-white/70 bg-white/70 text-brand-700 shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-green-300">
                      <ImageIcon className="h-9 w-9" />
                    </div>
                  </div>
                  <span className={`absolute left-4 top-4 rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[item.category]}`}>
                    {item.category}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">库存 {item.stock}</span>
                  </div>

                  <h2 className="mt-3 text-lg font-semibold tracking-tight">{item.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span className="rounded-md bg-black/[0.04] px-2 py-1 text-xs text-slate-500 dark:bg-white/[0.06] dark:text-slate-400" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-black/10 pt-4 dark:border-white/10">
                    <div>
                      <p className="text-2xl font-semibold text-brand-700 dark:text-green-300">{item.points}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">积分</p>
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
                      disabled={!canExchange}
                      type="button"
                    >
                      {canExchange ? (
                        <>
                          <TicketCheck className="h-4 w-4" />
                          兑换
                        </>
                      ) : (
                        disabledReason
                      )}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      校内线下领取
                    </div>
                    <span>不提供邮寄</span>
                  </div>
                </div>
              </div>
            </SurfacePanel>
          )
        })}
      </div>

      {filteredProducts.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10" />}
          title="没有匹配的商品"
          description="调整关键词、商品类型或排序方式后再试一次。"
        />
      )}

      <SurfacePanel className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <Award className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-green-300" />
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            积分仅用于平台内激励兑换，不具备现金价值。兑换通过后采用校内线下领取，不提供邮寄。存在违规测试、虚假提交、重复刷分等行为时，管理员可冻结兑换申请并追溯积分流水。
          </p>
        </div>
      </SurfacePanel>
    </PageSection>
  )
}
