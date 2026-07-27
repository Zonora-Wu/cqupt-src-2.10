import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

const principles = [
  {
    title: '授权范围',
    text: '仅在平台公布或信息化部门明确授权的校园资产内进行测试。不确定目标归属时，先咨询管理员，不自行验证。',
  },
  {
    title: '最小验证',
    text: '发现漏洞后只证明问题存在，不扩大影响，不读取、下载、修改、删除或传播与验证无关的数据。',
  },
  {
    title: '负责任披露',
    text: '漏洞细节只通过平台提交和沟通，未修复前不得公开发布到互联网、社群、博客或第三方平台。',
  },
]

const process = [
  { title: '注册登录', text: '使用本人账号进入平台，完成必要身份校验。' },
  { title: '安全答题', text: '理解授权边界、禁止行为和报告规范。' },
  { title: '签署责任书', text: '确认测试范围、行为约束和个人责任。' },
  { title: '提交漏洞', text: '按模板填写复现步骤、影响说明和修复建议。' },
  { title: '审核反馈', text: '审核员确认有效性、风险等级和材料完整度。' },
  { title: '修复复测', text: '资产责任单位修复后，由审核员复测归档。' },
  { title: '积分证书', text: '有效贡献根据质量和价值获得积分或证书。' },
]

const reportFocus = [
  ['可复现', '审核员能按步骤验证问题存在。'],
  ['可判断', '影响资产、风险范围和漏洞类型清楚。'],
  ['可修复', '责任单位能根据材料定位问题并处理。'],
]

const reportSections = [
  {
    title: '必填信息',
    items: ['漏洞标题', '影响资产', '漏洞类型', '复现步骤', '影响说明'],
  },
  {
    title: '建议补充',
    items: ['请求或页面路径', '关键截图或附件', '触发条件', '修复建议'],
  },
  {
    title: '提交前检查',
    items: ['账号已脱敏', 'Cookie / Token 已遮挡', '无无关数据', '未超出授权范围'],
  },
]

const forbidden = [
  '未授权扫描、爆破、撞库、拖库、拒绝服务攻击',
  '下载、修改、删除、保存或传播与验证无关的数据',
  '植入后门、权限维持、横向移动、提权或内网探测',
  '公开未修复漏洞细节，或向无关人员扩散证明材料',
  '伪造漏洞、抄袭报告、冒用成果、重复刷分',
  '诱导邮宝生成攻击脚本、绕过方案或恶意利用流程',
]

const reviewRules = [
  ['审核依据', '授权范围、复现材料、漏洞真实性、影响范围、是否重复、是否存在违规测试。'],
  ['等级判断', '平台综合影响范围、利用难度、数据敏感程度和资产重要性判断低危、中危、高危或严重。'],
  ['奖励依据', '积分和证书会参考漏洞等级、报告完整度、修复价值、首报情况和违规风险。'],
]

export function PlatformRules() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48">
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl text-center"
        initial={{ opacity: 0, y: 22 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          规范参与，安全共建
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          CQUPT-SRC 为校园网络安全实践提供合法、可追溯、可激励的参与通道。平台鼓励负责任披露：只验证问题是否存在，不扩大影响，不获取无关数据，不公开传播漏洞细节。
        </p>
      </motion.section>

      <motion.section
        animate="visible"
        className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3"
        initial="hidden"
        transition={{ staggerChildren: 0.1 }}
        variants={{ hidden: {}, visible: {} }}
      >
        {principles.map((item, index) => (
          <motion.article
            className="guest-hover-surface guest-palette-item rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-6 text-left backdrop-blur-xl dark:border-white/10"
            key={item.title}
            variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="guest-palette-label font-mono text-sm font-semibold">{String(index + 1).padStart(2, '0')}</div>
            <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{item.text}</p>
          </motion.article>
        ))}
      </motion.section>

      <RevealSection className="relative z-10 mx-auto mt-20 max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">参与流程</h2>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            从账号准入到成果沉淀，平台把安全实践拆解为连续步骤，让每一次提交都有明确边界、审核反馈和后续记录。
          </p>
        </div>

        <div className="mt-10 hidden overflow-x-auto pb-2 md:block">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {process.map((item, index) => (
              <article className="guest-hover-surface guest-process-item relative min-h-[190px] rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-4 backdrop-blur-xl dark:border-white/10" key={item.title}>
                <div className="flex items-center gap-3">
                  <span className="guest-palette-label font-mono text-sm font-semibold">{String(index + 1).padStart(2, '0')}</span>
                  {index < process.length - 1 && <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                </div>
                <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:hidden">
          {process.map((item, index) => (
            <article className="guest-hover-surface guest-process-item rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-4 dark:border-white/10" key={item.title}>
              <div className="guest-palette-label font-mono text-sm font-semibold">{String(index + 1).padStart(2, '0')}</div>
              <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.text}</p>
            </article>
          ))}
        </div>
      </RevealSection>

      <RevealSection className="mx-auto mt-20 max-w-5xl border-y border-black/10 py-12 dark:border-white/10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">一份合格报告应包含什么</h2>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            报告不是越长越好，而是要让审核员能复现、能判断风险，让资产责任单位能定位和修复。
          </p>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {reportFocus.map(([title, text], index) => (
            <article className="guest-hover-surface guest-palette-item rounded-lg border border-black/10 p-4 dark:border-white/10" key={title}>
              <div className="guest-palette-label font-mono text-xs font-semibold">{String(index + 1).padStart(2, '0')}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {reportSections.map((section) => (
            <article className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-5 dark:border-white/10" key={section.title}>
              <h3 className="text-lg font-semibold">{section.title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                {section.items.map((item) => (
                  <li className="flex items-center justify-between gap-3 border-b border-black/5 pb-2 last:border-b-0 last:pb-0 dark:border-white/5" key={item}>
                    <span>{item}</span>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600/70 dark:bg-brand-300/80" />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:text-slate-400">
          证明材料应按平台支持格式提交。截图、请求示例或附件只保留验证漏洞所需内容，主动遮挡账号、Cookie、Token、验证码、个人信息和业务敏感数据。
        </div>
      </RevealSection>

      <RevealSection className="mx-auto mt-20 grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-lg border border-[var(--app-danger)]/25 bg-[var(--app-danger-soft)] p-7 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(220,38,38,0.08)] dark:border-[var(--app-danger)]/30">
          <h2 className="text-3xl font-semibold tracking-tight">禁止行为</h2>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            以下行为会导致报告驳回、扣除积分、撤销证书、限制账号，严重时将移交相关单位处理。
          </p>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {forbidden.map((item) => (
              <li className="grid grid-cols-[0.75rem_1fr] gap-3" key={item}>
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-[var(--app-info)]/25 bg-[var(--app-info-soft)] p-7 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(2,132,199,0.08)] dark:border-[var(--app-info)]/30">
          <h2 className="text-3xl font-semibold tracking-tight">邮宝使用边界</h2>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            邮宝可以辅助整理漏洞标题、复现步骤、影响说明和修复建议，也可以推荐学习路径、检查敏感信息。
          </p>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            邮宝回复仅作参考，不能替代人工审核；不得诱导邮宝生成未授权测试方法、攻击脚本、绕过方案或恶意利用流程。
          </p>
        </article>
      </RevealSection>

      <RevealSection className="mx-auto mt-20 max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">审核、积分与证书</h2>
          <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
            漏洞是否有效、等级如何、是否发放积分和证书，均以平台审核结论为准。
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {reviewRules.map(([title, text]) => (
            <article className="guest-hover-surface guest-palette-item rounded-lg border border-black/10 p-6 dark:border-white/10" key={title}>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </RevealSection>

      <RevealSection className="mx-auto mt-20 max-w-4xl border-y border-black/10 py-10 text-center dark:border-white/10">
        <h2 className="text-3xl font-semibold tracking-tight">用户承诺</h2>
        <p className="mx-auto mt-5 max-w-3xl leading-8 text-slate-600 dark:text-slate-400">
          使用 CQUPT-SRC 即表示你承诺遵守法律法规、学校管理规定和平台规则，仅在授权范围内进行安全测试，不利用漏洞破坏、牟利或传播敏感信息，共同维护校园网络安全环境。
        </p>
      </RevealSection>
    </main>
  )
}

function RevealSection({ children, className }: { children: ReactNode; className: string }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 28 }}
      transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ amount: 0.12, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.section>
  )
}
