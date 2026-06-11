import { BookOpen, Download, FlaskConical, Search, Sparkles, Tags, Terminal } from 'lucide-react'

const resources = [
  { title: 'Burp Suite 入门指南', type: '工具教程', level: '入门', icon: Terminal },
  { title: 'Web 漏洞报告写作规范', type: '文档资料', level: '入门', icon: BookOpen },
  { title: 'SQL 注入基础靶场', type: '靶场训练', level: '基础', icon: FlaskConical },
  { title: 'XSS 漏洞复现与修复建议', type: '学习文章', level: '进阶', icon: Sparkles },
]

const categories = ['Web 安全', '工具资源', '靶场实践', '报告规范', '安全合规', 'AI 推荐']

export function LearningResources() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700 dark:text-green-300">
          <BookOpen className="h-4 w-4" />
          学习资源
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">从学习到实践的安全成长路径</h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          平台将沉淀工具、文档、靶场、课程和经验文章，帮助同学在授权范围内建立真实、规范、可持续的安全能力。
        </p>
      </section>

      <section className="mx-auto mt-14 max-w-3xl rounded-lg border border-black/10 bg-white/70 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex items-center gap-3">
          <Search className="ml-2 h-5 w-5 text-slate-400" />
          <input
            className="min-w-0 flex-1 border-none bg-transparent py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-600"
            placeholder="搜索工具、靶场、漏洞类型或学习路径"
            type="text"
          />
          <button className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700" type="button">
            搜索
          </button>
        </div>
      </section>

      <section className="mt-10 flex flex-wrap gap-3">
        {categories.map((item) => (
          <button className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-4 py-2 text-sm text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/[0.06]" key={item} type="button">
            <Tags className="h-4 w-4" />
            {item}
          </button>
        ))}
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {resources.map((item) => {
          const Icon = item.icon
          return (
            <article className="rounded-lg border border-black/10 bg-white/70 p-6 backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]" key={item.title}>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-green-300">
                <Icon className="h-6 w-6" />
              </div>
              <div className="mb-3 flex gap-2">
                <span className="rounded-md bg-brand-600/10 px-2 py-1 text-xs text-brand-700 dark:text-green-300">{item.type}</span>
                <span className="rounded-md bg-slate-500/10 px-2 py-1 text-xs text-slate-600 dark:text-slate-400">{item.level}</span>
              </div>
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                后续可接入资源详情、下载权限、收藏记录和 AI 学习路径推荐。
              </p>
              <button className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-green-300" type="button">
                <Download className="h-4 w-4" />
                查看资源
              </button>
            </article>
          )
        })}
      </section>
    </main>
  )
}
