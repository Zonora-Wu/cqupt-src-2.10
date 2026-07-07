import { Building2, GraduationCap, Network, ShieldCheck, Target, Users } from 'lucide-react'

const values = [
  {
    title: '服务校园安全治理',
    icon: ShieldCheck,
    text: '将漏洞发现、审核响应、修复跟进和复测归档纳入统一平台，提升校园安全工作的可追溯性。',
  },
  {
    title: '服务学生能力成长',
    icon: GraduationCap,
    text: '为学生提供合法授权的实践通道，让学习、靶场训练、真实漏洞提交和证书激励形成正反馈。',
  },
  {
    title: '服务产教融合建设',
    icon: Network,
    text: '通过平台沉淀漏洞数据、学习轨迹和贡献成果，反哺课程建设、人才发现和科研实践。',
  },
]

const stakeholders = [
  { label: '学生', icon: Users, desc: '提交漏洞、参与学习、获得反馈与证书' },
  { label: '学院', icon: Building2, desc: '观察人才培养效果，沉淀实践成果' },
  { label: '信息化部门', icon: ShieldCheck, desc: '审核漏洞、推动修复、管理安全风险' },
]

export function AboutPlatform() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-36 md:px-8 md:pt-40">
      <section className="grid items-end gap-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700 dark:text-brand-300">
            <Target className="h-4 w-4" />
            关于平台
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">不只是漏洞库，而是安全教育与治理系统</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
            CQUPT-SRC 希望以较低建设成本，形成一个连接漏洞响应、安全学习、证书激励和校园安全治理的长期平台，推动高校网络安全产教融合实践。
          </p>
        </div>

        <div className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10  dark:shadow-none">
          <div className="text-sm font-medium text-brand-700 dark:text-brand-300">平台定位</div>
          <p className="mt-4 text-2xl font-semibold leading-snug text-slate-950 dark:text-white">
            以授权测试为边界，以真实反馈为闭环，以可追溯数据支撑校园安全治理。
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {['响应', '学习', '激励'].map((item) => (
              <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-4 dark:border-white/10 " key={item}>
                <div className="text-lg font-semibold text-brand-700 dark:text-brand-300">{item}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">闭环能力</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-5 md:grid-cols-3">
        {values.map((item) => {
          const Icon = item.icon
          return (
            <article className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-7 backdrop-blur-xl transition hover:bg-white dark:border-white/10  dark:hover:bg-white/[0.06]" key={item.title}>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-brand-300">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{item.text}</p>
            </article>
          )
        })}
      </section>

      <section className="mt-14 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-7 backdrop-blur-xl dark:border-white/10 ">
          <h2 className="text-2xl font-semibold">平台愿景</h2>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            平台的核心目标不是简单收集漏洞，而是建立一个可持续的校园安全正循环：学生在真实场景中学习和成长，学校在规范流程中发现和处置风险，学院获得可观测的人才培养数据，最终形成可复制、可推广的高校网络安全产教融合案例。
          </p>
        </article>

        <section className="grid gap-5 md:grid-cols-3">
          {stakeholders.map((item) => {
            const Icon = item.icon
            return (
              <article className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-6 text-center backdrop-blur-xl dark:border-white/10 " key={item.label}>
                <Icon className="mx-auto mb-4 h-8 w-8 text-brand-700 dark:text-brand-300" />
                <h3 className="text-lg font-semibold">{item.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.desc}</p>
              </article>
            )
          })}
        </section>
      </section>
    </main>
  )
}
