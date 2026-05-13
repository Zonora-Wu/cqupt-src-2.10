import { BookOpen, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'

const accessNotes = [
  '学习资料、工具入口和靶场链接仅面向已登录校内用户开放。',
  '进入资源或靶场时，平台会记录访问次数，用于资源维护和学习服务优化。',
  '所有训练活动必须遵守 CQUPT-SRC 授权测试规则和校园网络安全测试行为边界。',
]

export function LearningResources() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700 dark:text-green-300">
          <BookOpen className="h-4 w-4" />
          学习资源
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">登录后进入学习中心</h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          CQUPT-SRC 的工具资料、学习文档和靶场资源仅向已认证的校内用户开放。请完成登录后，在用户端学习中心查看可访问资源。
        </p>
      </section>

      <section className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
        {accessNotes.map((note, index) => (
          <article
            className="rounded-lg border border-black/10 bg-white p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035]"
            key={note}
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-green-300">
              {index === 0 && <LockKeyhole className="h-6 w-6" />}
              {index === 1 && <Sparkles className="h-6 w-6" />}
              {index === 2 && <ShieldCheck className="h-6 w-6" />}
            </div>
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{note}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto mt-10 max-w-5xl rounded-lg border border-black/10 bg-white p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-semibold">为什么访客不可查看资源？</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              平台资源包含安全工具、训练入口和测试规范，必须结合用户身份、授权范围和责任书签署状态使用。访客页面仅提供平台说明和证书公开核验能力。
            </p>
          </div>
          <div className="rounded-lg border border-brand-600/20 bg-brand-600/10 px-4 py-3 text-sm font-medium text-brand-700 dark:text-green-300">
            校内认证后可用
          </div>
        </div>
      </section>
    </main>
  )
}
