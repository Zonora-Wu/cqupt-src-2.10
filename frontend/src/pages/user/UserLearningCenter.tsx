import {
  BookOpen,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers3,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { clickLearningResource, listLearningResources } from '../../services/learning'
import type { LearningResourceItem } from '../../services/learning'

const kindOptions = ['全部资源', '工具资料', '靶场资源']

const learningPath = [
  { title: '完成授权测试规则答题', status: '已完成', icon: ShieldCheck },
  { title: '阅读漏洞提交规范手册', status: '建议今天完成', icon: BookOpen },
  { title: '进入权限控制专题靶场', status: 'AI 推荐', icon: Target },
]

const categoryStyles: Record<string, string> = {
  工具资源: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  文档资料: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  视频课程: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  漏洞报告模板: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  Web靶场: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  Web靶场资源: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  权限控制靶场: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  代码审计靶场: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
}

export function UserLearningCenter() {
  const [resources, setResources] = useState<LearningResourceItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [kind, setKind] = useState('全部资源')
  const [category, setCategory] = useState('全部分类')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadResources() {
    setError('')
    setLoading(true)
    try {
      const response = await listLearningResources()
      setResources(response.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '学习资源加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadResources()
  }, [])

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(resources.map((item) => item.category))).sort()
    return ['全部分类', ...categories]
  }, [resources])

  const overview = useMemo(() => {
    const resourceCount = resources.filter((item) => item.kind === 'RESOURCE').length
    const rangeCount = resources.filter((item) => item.kind === 'RANGE').length
    return [
      { label: '工具资料', value: String(resourceCount), hint: '登录后可访问', icon: TerminalSquare },
      { label: '靶场资源', value: String(rangeCount), hint: '外部链接入口', icon: Target },
      { label: '累计访问', value: String(resources.reduce((total, item) => total + item.downloadCount, 0)), hint: '平台统计', icon: FileText },
      { label: '已上架', value: String(resources.length), hint: '可用资源', icon: CheckCircle2 },
    ]
  }, [resources])

  const filteredResources = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return resources.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.category.toLowerCase().includes(normalizedKeyword)
      const matchesKind = kind === '全部资源' || item.kindLabel === kind
      const matchesCategory = category === '全部分类' || item.category === category

      return matchesKeyword && matchesKind && matchesCategory
    })
  }, [category, keyword, kind, resources])

  async function openResource(item: LearningResourceItem) {
    setMessage('')
    try {
      const result = await clickLearningResource(item.id)
      setResources((current) =>
        current.map((resource) =>
          resource.id === item.id ? { ...resource, downloadCount: result.downloadCount } : resource,
        ),
      )
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (clickError) {
      setMessage(clickError instanceof Error ? clickError.message : '资源访问失败')
    }
  }

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfacePanel className="overflow-hidden p-0">
          <div className="relative p-7 md:p-8">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
              <GraduationCap className="h-3.5 w-3.5" />
              Learning Center
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">学习中心</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
              下载安全工具、阅读学习资料，并进入授权靶场资源进行练习。所有资源需要登录后访问，点击访问会记录资源使用次数。
            </p>
            <div className="mt-7 grid gap-3 md:grid-cols-4">
              {overview.map((item) => {
                const Icon = item.icon
                return (
                  <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]" key={item.label}>
                    <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                    <p className="mt-4 text-3xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">AI 学习建议</p>
              <h2 className="mt-1 text-xl font-semibold">下一步训练</h2>
            </div>
            <Sparkles className="h-8 w-8 text-brand-700 dark:text-green-300" />
          </div>
          <div className="mt-5 space-y-3">
            {learningPath.map((item) => {
              const Icon = item.icon
              return (
                <div className="rounded-lg border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]" key={item.title}>
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-green-300" />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.status}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700" type="button">
            <Bot className="h-4 w-4" />
            让 AI 生成学习计划
          </button>
        </SurfacePanel>
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px] lg:items-end">
          <SearchInput label="搜索资源" onChange={setKeyword} placeholder="输入工具、资料、靶场或分类" value={keyword} />
          <SelectInput label="资源类型" onChange={setKind} options={kindOptions} value={kind} />
          <SelectInput label="分类" onChange={setCategory} options={categoryOptions} value={category} />
        </div>
      </SurfacePanel>

      {message && <AlertMessage className="mt-4" message={message} onClose={() => setMessage('')} variant="error" />}
      {error && <AlertMessage className="mt-4" message={error} onClose={() => setError('')} variant="error" />}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {loading && <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 lg:col-span-2">正在加载学习资源...</SurfacePanel>}

        {!loading &&
          filteredResources.map((item) => (
            <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[item.category] ?? categoryStyles.工具资源}`}>{item.category}</span>
                    <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">{item.kindLabel}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.title}</h2>
                </div>
                {item.kind === 'RANGE' ? (
                  <PlayCircle className="h-6 w-6 shrink-0 text-brand-700 dark:text-green-300" />
                ) : (
                  <Layers3 className="h-6 w-6 shrink-0 text-brand-700 dark:text-green-300" />
                )}
              </div>

              <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  访问 {item.downloadCount} 次 · 更新于 {formatDate(item.updatedAt)}
                </div>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  onClick={() => void openResource(item)}
                  type="button"
                >
                  {item.kind === 'RANGE' ? (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      进入靶场
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      访问资源
                    </>
                  )}
                </button>
              </div>
            </SurfacePanel>
          ))}
      </div>

      {!loading && filteredResources.length === 0 && (
        <EmptyState icon={<BookOpen className="h-10 w-10" />} title="没有匹配的学习资源" description="调整关键词、资源类型或分类后再试一次。" />
      )}
    </section>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN')
}
