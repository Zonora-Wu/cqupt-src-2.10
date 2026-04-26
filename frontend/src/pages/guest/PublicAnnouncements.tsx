import { Bell, CalendarDays, ChevronRight, Megaphone, Pin } from 'lucide-react'

const announcements = [
  {
    title: 'CQUPT-SRC 平台试运行规则说明',
    date: '2026-04-26',
    type: '平台规则',
    pinned: true,
    summary: '平台试运行期间，所有漏洞提交需先完成安全准入流程，并严格遵守授权测试范围。',
  },
  {
    title: '关于漏洞证书公开查询能力的说明',
    date: '2026-04-20',
    type: '证书体系',
    pinned: true,
    summary: '证书查询仅展示证书真实性、颁发状态与脱敏信息，不公开漏洞资产、复现步骤和附件。',
  },
  {
    title: '学习资源与靶场内容征集',
    date: '2026-04-12',
    type: '学习实践',
    pinned: false,
    summary: '欢迎同学和老师提交适合校内授权学习的工具资源、文档资料和靶场训练建议。',
  },
  {
    title: '漏洞提交报告格式建议',
    date: '2026-04-05',
    type: '漏洞响应',
    pinned: false,
    summary: '建议漏洞报告包含影响资产、漏洞类型、复现步骤、影响说明、证明材料和修复建议。',
  },
]

export function PublicAnnouncements() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700 dark:text-green-300">
          <Megaphone className="h-4 w-4" />
          公开公告
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">平台动态与规则更新</h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          查看 CQUPT-SRC 的公开通知、规则调整、学习活动与证书体系说明。涉及漏洞细节、敏感资产和审核信息的内容不会公开展示。
        </p>
      </section>

      <section className="mt-16 grid gap-5">
        {announcements.map((item) => (
          <article
            className="group rounded-lg border border-black/10 bg-white/70 p-6 backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]"
            key={item.title}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-green-300">
                  {item.pinned ? <Pin className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-700 dark:text-green-300">
                      {item.type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {item.date}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{item.summary}</p>
                </div>
              </div>
              <button className="inline-flex items-center gap-1 self-start rounded-lg border border-black/10 px-3 py-2 text-sm text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5" type="button">
                查看详情
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
