import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from 'lucide-react'

const ruleCards = [
  {
    title: '授权准入',
    icon: ShieldCheck,
    text: '用户完成注册后，需要通过邮箱验证、安全规范答题并签署网络安全责任承诺书，才可在授权范围内提交漏洞。',
  },
  {
    title: '测试范围',
    icon: LockKeyhole,
    text: '仅允许在平台公布或信息化部门明确授权的校园网络资产范围内进行安全测试，不得越权扫描、攻击或影响业务运行。',
  },
  {
    title: '提交要求',
    icon: FileCheck2,
    text: '漏洞报告应包含标题、影响资产、漏洞类型、风险说明、复现步骤、证明材料和修复建议，避免提交无效、重复或无法验证的信息。',
  },
  {
    title: '合规边界',
    icon: Scale,
    text: '禁止利用漏洞获取、篡改、删除数据，禁止传播漏洞细节，禁止植入后门、拖库、批量扫描或进行任何非授权攻击行为。',
  },
]

const process = [
  '提交漏洞',
  '平台初筛',
  '审核员确认',
  '资产单位修复',
  '复测归档',
  '积分与证书',
]

const forbidden = [
  '未经授权对校园资产进行大规模扫描、爆破、压力测试或自动化攻击。',
  '读取、下载、传播或保存与漏洞验证无关的敏感数据。',
  '利用漏洞进行权限维持、后门植入、数据篡改、业务破坏或账号接管。',
  '将未修复漏洞公开发布到互联网、社群、博客或第三方平台。',
  '伪造漏洞证明、冒用他人成果、重复提交已知漏洞骗取积分或证书。',
]

const responseLevels = [
  { level: '严重 / 高危', time: '24 小时内响应', color: 'text-red-500 dark:text-red-300' },
  { level: '中危', time: '72 小时内响应', color: 'text-amber-600 dark:text-amber-300' },
  { level: '低危 / 信息', time: '7 天内响应', color: 'text-brand-700 dark:text-green-300' },
]

export function PlatformRules() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700 dark:text-green-300">
          <ShieldCheck className="h-4 w-4" />
          平台规则
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">规范参与，安全共建</h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          CQUPT-SRC 为校园网络安全实践提供合法、可追溯、可激励的参与通道。所有漏洞测试、提交、审核与奖励都应在授权范围和平台规则内完成。
        </p>
      </section>

      <section className="mt-16 grid gap-5 md:grid-cols-2">
        {ruleCards.map((item) => {
          const Icon = item.icon
          return (
            <article
              className="rounded-lg border border-black/10 bg-white/70 p-7 backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]"
              key={item.title}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-green-300">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{item.text}</p>
            </article>
          )
        })}
      </section>

      <section className="mt-16 rounded-lg border border-black/10 bg-white/70 p-7 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">漏洞处理流程</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              每一条有效漏洞都会进入可追踪的闭环流程，审核、修复、复测和奖励均保留记录。
            </p>
          </div>
          <Clock3 className="hidden h-10 w-10 text-brand-700 dark:text-green-300 md:block" />
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-6">
          {process.map((item, index) => (
            <div className="rounded-lg border border-black/10 bg-white/80 p-4 text-center dark:border-white/10 dark:bg-black/20" key={item}>
              <CheckCircle2 className="mx-auto mb-3 h-5 w-5 text-brand-700 dark:text-green-300" />
              <p className="text-sm font-medium">{item}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">0{index + 1}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-lg border border-red-500/20 bg-red-500/5 p-7 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">禁止行为</h2>
          </div>
          <ul className="space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
            {forbidden.map((item) => (
              <li className="flex gap-3" key={item}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-black/10 bg-white/70 p-7 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <h2 className="text-2xl font-semibold">响应时效参考</h2>
          <p className="mt-2 leading-7 text-slate-600 dark:text-slate-400">
            实际响应时间会根据漏洞影响范围、资产单位协同情况和证明材料完整度进行调整。
          </p>
          <div className="mt-6 space-y-3">
            {responseLevels.map((item) => (
              <div className="flex items-center justify-between rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-black/20" key={item.level}>
                <span className={`font-semibold ${item.color}`}>{item.level}</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">{item.time}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <article className="rounded-lg border border-black/10 bg-white/70 p-7 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-600 dark:text-amber-300">
            <Award className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-semibold">积分与证书</h2>
          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
            平台将根据漏洞等级、影响范围、报告质量、是否重复和修复价值综合评定积分。高价值漏洞可由审核员颁发漏洞贡献证书，证书支持公开验证但不会公开漏洞细节。
          </p>
        </article>

        <article className="rounded-lg border border-black/10 bg-white/70 p-7 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-green-300">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-semibold">隐私与保密</h2>
          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
            漏洞详情、附件、审核意见和敏感资产信息仅对提交者、审核员和授权管理员可见。任何涉及账号、个人信息、Cookie、Token 或业务数据的内容都应最小化展示并按平台要求脱敏。
          </p>
        </article>
      </section>
    </main>
  )
}
