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
import { useMemo, useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

const categoryOptions = ['全部资源', '工具下载', '学习资料', '靶场资源']
const levelOptions = ['全部难度', '入门', '进阶', '实战']

const overview = [
  { label: '工具资源', value: '24', hint: '已整理可下载', icon: TerminalSquare },
  { label: '学习资料', value: '36', hint: '规范、教程与文档', icon: FileText },
  { label: '靶场资源', value: '12', hint: '可用于授权训练', icon: Target },
  { label: '已完成', value: '7', hint: '个人学习记录', icon: CheckCircle2 },
]

const resources = [
  {
    title: 'Web 漏洞测试基础工具包',
    category: '工具下载',
    level: '入门',
    description: '包含请求重放、目录枚举、编码转换、弱口令自查等常用工具说明与下载入口。',
    size: '128 MB',
    updatedAt: '2026-04-24',
    tags: ['Web', '工具', '基础'],
  },
  {
    title: 'CQUPT-SRC 漏洞提交规范手册',
    category: '学习资料',
    level: '入门',
    description: '说明漏洞报告结构、复现材料边界、敏感数据处理方式和禁止行为。',
    size: '3.6 MB',
    updatedAt: '2026-04-22',
    tags: ['规范', '报告', '边界'],
  },
  {
    title: '权限控制与越权漏洞训练靶场',
    category: '靶场资源',
    level: '进阶',
    description: '覆盖水平越权、垂直越权、接口鉴权缺失和越权复测方法。',
    size: '在线环境',
    updatedAt: '2026-04-20',
    tags: ['越权', '接口', '靶场'],
  },
  {
    title: 'SQL 注入基础到利用证明训练',
    category: '靶场资源',
    level: '入门',
    description: '从参数识别、报错判断到安全证明材料整理，强调不下载、不破坏数据。',
    size: '在线环境',
    updatedAt: '2026-04-18',
    tags: ['SQLi', '复现', '证明'],
  },
  {
    title: '校园资产安全测试行为边界说明',
    category: '学习资料',
    level: '入门',
    description: '用于理解授权测试范围、漏洞修复前保密要求、禁止扫描爆破等行为。',
    size: '2.1 MB',
    updatedAt: '2026-04-16',
    tags: ['安全规范', '授权', '责任书'],
  },
  {
    title: '日志分析与漏洞复测辅助工具',
    category: '工具下载',
    level: '实战',
    description: '面向复测阶段的请求记录整理、时间线生成和修复前后差异对比。',
    size: '56 MB',
    updatedAt: '2026-04-12',
    tags: ['日志', '复测', '分析'],
  },
]

const learningPath = [
  { title: '完成授权测试规则答题', status: '已完成', icon: ShieldCheck },
  { title: '阅读漏洞提交规范手册', status: '建议今天完成', icon: BookOpen },
  { title: '进入权限控制专题靶场', status: 'AI 推荐', icon: Target },
]

const categoryStyles: Record<string, string> = {
  工具下载: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  学习资料: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  靶场资源: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export function UserLearningCenter() {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部资源')
  const [level, setLevel] = useState('全部难度')

  const filteredResources = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return resources.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword))
      const matchesCategory = category === '全部资源' || item.category === category
      const matchesLevel = level === '全部难度' || item.level === level

      return matchesKeyword && matchesCategory && matchesLevel
    })
  }, [category, keyword, level])

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfacePanel className="overflow-hidden p-0">
          <div className="relative p-7 md:p-8">
            <div className="pointer-events-none absolute right-10 top-10 h-32 w-32 rounded-full bg-brand-600/10 blur-3xl dark:bg-green-300/10" />
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
              <GraduationCap className="h-3.5 w-3.5" />
              Learning Center
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">学习中心</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
              集中获取安全测试工具、规范资料和靶场资源。所有内容都服务于授权范围内的学习、复现、报告撰写与能力成长。
            </p>
            <div className="mt-7 grid gap-3 md:grid-cols-4">
              {overview.map((item) => {
                const Icon = item.icon
                return (
                  <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]" key={item.label}>
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
                <div className="rounded-lg border border-black/5 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]" key={item.title}>
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
          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            type="button"
          >
            <Bot className="h-4 w-4" />
            让 AI 生成学习计划
          </button>
        </SurfacePanel>
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px] lg:items-end">
          <SearchInput
            label="搜索资源"
            onChange={setKeyword}
            placeholder="输入工具、资料、靶场或标签"
            value={keyword}
          />
          <SelectInput label="资源类型" onChange={setCategory} options={categoryOptions} value={category} />
          <SelectInput label="难度等级" onChange={setLevel} options={levelOptions} value={level} />
        </div>
      </SurfacePanel>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {filteredResources.map((item) => (
          <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.title}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[item.category]}`}>{item.category}</span>
                  <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                    {item.level}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.title}</h2>
              </div>
              {item.category === '靶场资源' ? (
                <PlayCircle className="h-6 w-6 shrink-0 text-brand-700 dark:text-green-300" />
              ) : (
                <Layers3 className="h-6 w-6 shrink-0 text-brand-700 dark:text-green-300" />
              )}
            </div>

            <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span className="rounded-md bg-black/[0.04] px-2 py-1 text-xs text-slate-500 dark:bg-white/[0.06] dark:text-slate-400" key={tag}>
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {item.size} · 更新于 {item.updatedAt}
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                type="button"
              >
                {item.category === '靶场资源' ? (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    进入靶场
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    下载资源
                  </>
                )}
              </button>
            </div>
          </SurfacePanel>
        ))}
      </div>

      {filteredResources.length === 0 && (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" />}
          title="没有匹配的学习资源"
          description="调整关键词、资源类型或难度等级后再试一次。"
        />
      )}
    </section>
  )
}
