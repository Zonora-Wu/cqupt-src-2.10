import { ChevronDown, ExternalLink, FileText } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SpotlightCard } from '../../components/ui/SpotlightCard'

const PROPOSAL_URL = 'https://lanshanteam.feishu.cn/wiki/GRR6wRh6IinV7QkxIbAc23krnSb'

type Speaker = 'boundary' | 'engineering' | 'initiator' | 'learning' | 'operations' | 'reviewer'

type ChatEvent =
  | { delay: number; kind: 'message'; speaker: Speaker; text: string }
  | { delay: number; kind: 'document'; speaker: Speaker }
  | { count: number; delay: number; kind: 'read' }

const speakers: Record<Speaker, { avatar: string; label: string }> = {
  initiator: { avatar: '/assets/avatars/about-discussion/initiator.jpg', label: '匿名同学' },
  engineering: { avatar: '/assets/avatars/about-discussion/engineering.jpg', label: '匿名同学' },
  learning: { avatar: '/assets/avatars/about-discussion/learning.jpg', label: '匿名同学' },
  boundary: { avatar: '/assets/avatars/about-discussion/boundary.jpg', label: '匿名同学' },
  operations: { avatar: '/assets/avatars/about-discussion/operations.jpg', label: '匿名同学' },
  reviewer: { avatar: '/assets/avatars/about-discussion/reviewer.jpg', label: '匿名同学' },
}

const chatEvents: ChatEvent[] = [
  { delay: 500, kind: 'message', speaker: 'initiator', text: '安全组现在发现的漏洞还是零散整理。能不能有一个统一的平台？' },
  { delay: 1250, kind: 'message', speaker: 'engineering', text: '如果只是把报告放在一起，那不还是一个漏洞库吗？' },
  { delay: 1300, kind: 'message', speaker: 'initiator', text: '所以不能只收集。提交、审核、修复、复测、归档，整个过程都应该留在平台里。' },
  { delay: 1450, kind: 'message', speaker: 'learning', text: '但学生为什么愿意一直参与？真实实践需要有持续的正向反馈。' },
  { delay: 1250, kind: 'message', speaker: 'operations', text: '可以有积分、校级证书、学习资源，还有参与项目的机会。' },
  { delay: 1300, kind: 'message', speaker: 'boundary', text: '校园测试必须先明确授权范围。安全答题、责任书和资产边界都不能少。' },
  { delay: 1450, kind: 'message', speaker: 'engineering', text: '这样平台既保护学校，也让同学能在合法范围内练习真正需要的能力。' },
  { delay: 1250, kind: 'message', speaker: 'reviewer', text: '审核进度也要透明。需要补材料、确认有效或者进入修复，都应该及时通知提交者。' },
  { delay: 1300, kind: 'message', speaker: 'learning', text: '数据还能帮助学院看到学生什么时候具备了能力，课程和人才培养也有依据。' },
  { delay: 1250, kind: 'message', speaker: 'operations', text: '证书还应该可以公开验真，让每一份贡献都有可信的成长记录。' },
  { delay: 1450, kind: 'message', speaker: 'initiator', text: '学生成长、学院教学、学校安全治理，可以在同一个闭环里互相推动。' },
  { delay: 1250, kind: 'message', speaker: 'reviewer', text: '平台要能长期运营，规则、审计和数据都得从一开始就认真设计。' },
  { delay: 1500, kind: 'document', speaker: 'initiator' },
  { count: 2, delay: 1200, kind: 'read' },
  { count: 4, delay: 1050, kind: 'read' },
  { count: 6, delay: 1050, kind: 'read' },
  { delay: 1000, kind: 'message', speaker: 'boundary', text: '看完了。这个已经不只是漏洞库了。' },
  { delay: 1100, kind: 'message', speaker: 'learning', text: '学生实践和学校安全都能真正受益。' },
  { delay: 1100, kind: 'message', speaker: 'engineering', text: '可以做，先把漏洞响应闭环跑起来。' },
  { delay: 1250, kind: 'message', speaker: 'initiator', text: '那就从 CQUPT-SRC 开始。' },
]

const platformReasons = [
  {
    title: '让实践有合法边界',
    text: '通过安全准入、责任书、授权范围和审计记录，为学生提供规范、可追溯的真实安全实践通道。',
  },
  {
    title: '让漏洞真正被解决',
    text: '报告进入分级审核、修复协同、复测和归档流程，不以收集漏洞为终点。',
  },
  {
    title: '让贡献形成成长记录',
    text: '把有效漏洞、学习过程、积分和证书沉淀为可验证成果，服务人才发现与能力培养。',
  },
]

const buildingPrinciples = [
  {
    title: '合规优先',
    text: '技术实践必须建立在明确授权和责任边界之上，平台能力始终服务于规范参与。',
  },
  {
    title: '真实反馈',
    text: '学生提交的成果获得明确审核结论与改进建议，让实践过程真正产生学习价值。',
  },
  {
    title: '共同受益',
    text: '学生获得成长记录，学院获得培养依据，学校获得持续改进的安全治理能力。',
  },
  {
    title: '长期运营',
    text: '平台不是一次性项目，而是持续积累规则、数据和实践经验的校园基础能力。',
  },
]

export function AboutPlatform() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 md:px-8">
      <section className="relative grid min-h-[100svh] items-center gap-10 pb-20 pt-28 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14 lg:pb-24 lg:pt-24">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          initial={{ opacity: 0, x: -22 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            一次讨论，逐渐成为一套校园安全实践
          </h1>
          <p className="mt-6 text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
            CQUPT-SRC 由蓝山工作室运维安全部安全组发起建设。最初的设想不是再做一个漏洞库，而是让学生成长、漏洞响应和校园安全治理形成长期闭环。
          </p>
          <div className="mt-8 border-l-2 border-brand-600 pl-5">
            <p className="text-sm font-semibold">发起与建设</p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">蓝山工作室运维安全部安全组</p>
          </div>
        </motion.div>

        <OriginChat />

        <button
          aria-label="继续浏览关于平台"
          className="absolute bottom-5 left-1/2 hidden h-10 w-10 -translate-x-1/2 place-items-center rounded-full text-slate-500 opacity-55 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 motion-safe:animate-[guest-scroll-hint_2.4s_ease-in-out_infinite] lg:grid dark:text-slate-300"
          onClick={() => document.getElementById('about-platform-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          type="button"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </section>

      <RevealSection className="scroll-mt-20 pt-24" id="about-platform-content">
        <SectionHeading
          description="平台从真实问题出发：学生需要合法实践，漏洞需要持续跟进，学校需要可观察、可复用的安全治理数据。"
          title="为什么建设 CQUPT-SRC"
        />
        <div className="mt-12 grid gap-0 border-b border-black/10 md:grid-cols-3 dark:border-white/10">
          {platformReasons.map((item, index) => (
            <SpotlightCard
              className={`guest-hover-surface guest-palette-item px-5 py-8 md:px-7 ${
                index < platformReasons.length - 1 ? 'md:border-r md:border-black/10 md:dark:border-white/10' : ''
              }`}
              key={item.title}
              spotlightColor="color-mix(in srgb, var(--guest-accent) 20%, transparent)"
            >
              <div className="relative z-10">
                <span className="guest-palette-label font-mono text-xs font-semibold">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{item.text}</p>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </RevealSection>

      <RevealSection className="mt-24">
        <SectionHeading
          description="平台如何建设，不只取决于功能数量，更取决于是否始终回应校园场景中的真实问题。"
          title="平台建设原则"
        />
        <div className="mt-12 grid border-b border-black/10 md:grid-cols-2 dark:border-white/10">
          {buildingPrinciples.map((item, index) => (
            <SpotlightCard
              className={`guest-hover-surface guest-palette-item px-5 py-8 md:px-8 ${
                index % 2 === 0 ? 'md:border-r md:border-black/10 md:dark:border-white/10' : ''
              } ${
                index < buildingPrinciples.length - 2 ? 'border-b border-black/10 dark:border-white/10' : ''
              }`}
              key={item.title}
              spotlightColor="color-mix(in srgb, var(--guest-accent) 20%, transparent)"
            >
              <div className="relative z-10">
                <div className="guest-palette-label font-mono text-sm font-semibold">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{item.text}</p>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </RevealSection>

      <RevealSection className="mt-24 grid gap-10 border-y border-black/10 py-12 lg:grid-cols-[0.85fr_1.15fr] dark:border-white/10">
        <div>
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">建设信息</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">由学生团队发起，服务长期校园安全建设</h2>
        </div>
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <InfoField label="发起与建设" value="蓝山工作室运维安全部安全组" />
          <InfoField label="平台名称" value="CQUPT-SRC" />
          <InfoField label="建设方向" value="漏洞响应、安全学习、实践激励、校园安全治理" />
          <InfoField label="当前状态" value="持续建设中" />
        </dl>
      </RevealSection>

      <RevealSection className="mx-auto mt-24 max-w-4xl text-center">
        <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">长期愿景</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">不只是漏洞库，而是安全教育与治理系统</h2>
        <p className="mt-6 leading-8 text-slate-600 dark:text-slate-400">
          平台希望让学生在真实场景中建立规则意识与工程能力，让漏洞在规范流程中被发现和解决，让实践数据反哺人才培养与校园安全治理，逐步形成可持续、可复制的高校网络安全产教融合实践。
        </p>
      </RevealSection>
    </main>
  )
}

function OriginChat() {
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(-1)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [inView, setInView] = useState(true)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.2 })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    if (hoverPaused || !inView) return

    const nextIndex = step + 1
    const timeout = window.setTimeout(
      () => setStep(nextIndex < chatEvents.length ? nextIndex : -1),
      nextIndex < chatEvents.length ? chatEvents[nextIndex].delay : 5000,
    )
    return () => window.clearTimeout(timeout)
  }, [hoverPaused, inView, reduceMotion, step])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const frame = window.requestAnimationFrame(() => {
      container.scrollTo({ behavior: reduceMotion ? 'auto' : 'smooth', top: container.scrollHeight })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [reduceMotion, step])

  const effectiveStep = reduceMotion ? chatEvents.length - 1 : step
  const visibleEvents = useMemo(() => chatEvents.slice(0, effectiveStep + 1), [effectiveStep])
  const readCount = visibleEvents.reduce((count, event) => event.kind === 'read' ? event.count : count, 0)

  return (
    <motion.section
      className="min-w-0"
      initial={{ opacity: 0, x: 24 }}
      transition={{ delay: 0.16, duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div
        className="overflow-hidden rounded-lg border border-black/10 bg-[var(--app-surface)] shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
        ref={frameRef}
      >
        <header className="flex h-14 items-center justify-between border-b border-black/10 px-5 dark:border-white/10">
          <div>
            <div className="text-sm font-semibold">平台构想讨论</div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">6 名参与者</div>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">{hoverPaused ? '已暂停' : '讨论中'}</span>
        </header>

        <div
          className="platform-scrollbar h-[380px] overflow-y-auto bg-[color-mix(in_srgb,var(--app-bg)_56%,var(--app-surface))] px-4 py-6 sm:h-[420px] sm:px-7 lg:h-[480px]"
          ref={scrollRef}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            <AnimatePresence initial={false}>
              {visibleEvents.map((event, index) => {
                if (event.kind === 'read') return null
                return (
                  <ChatEntry
                    event={event}
                    key={`${event.kind}-${index}`}
                    readCount={readCount}
                    side={index % 3 === 1 ? 'right' : 'left'}
                  />
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
        动画根据原始项目提案重构；悬停窗口可暂停
      </p>
    </motion.section>
  )
}

function ChatEntry({
  event,
  readCount,
  side,
}: {
  event: Extract<ChatEvent, { kind: 'document' | 'message' }>
  readCount: number
  side: 'left' | 'right'
}) {
  const { avatar, label } = speakers[event.speaker]
  const right = side === 'right'
  const displayedAvatar = right
    ? speakers.learning.avatar
    : event.speaker === 'learning'
      ? speakers.reviewer.avatar
      : avatar

  return (
    <motion.div
      animate={{ opacity: 1, x: 0, y: 0 }}
      className={`flex items-start gap-3 ${right ? 'flex-row-reverse' : ''}`}
      exit={{ opacity: 0, y: -8 }}
      initial={{ opacity: 0, x: right ? 18 : -18, y: 8 }}
      layout
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      <img
        alt=""
        className="mt-5 h-10 w-10 shrink-0 rounded-full border border-black/10 object-cover dark:border-white/10"
        height="40"
        src={displayedAvatar}
        width="40"
      />
      <div className={`min-w-0 max-w-[82%] sm:max-w-[72%] ${right ? 'items-end text-right' : 'items-start'} flex flex-col`}>
        <span className="mb-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500">{label}</span>
        {event.kind === 'message' ? (
          <div
            className={`rounded-lg border px-4 py-3 text-left text-sm leading-6 ${
              right
                ? 'border-brand-600/20 bg-brand-600/10 text-slate-800 dark:text-slate-200'
                : 'border-black/10 bg-[var(--app-surface)] text-slate-700 dark:border-white/10 dark:text-slate-300'
            }`}
          >
            {event.text}
          </div>
        ) : (
          <a
            className="guest-hover-surface block w-full min-w-[260px] rounded-lg border border-black/10 bg-[var(--app-surface)] p-4 text-left dark:border-white/10 sm:min-w-[360px]"
            href={PROPOSAL_URL}
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-brand-300">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">CQUPT-SRC 校级漏洞响应平台个人提案</div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">从漏洞库到全链路教育 SRC</div>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
            </div>
            <div className="mt-4 border-t border-black/10 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              {readCount >= 6 ? '6 人全部已读' : readCount > 0 ? `${readCount} 人已查看` : '飞书文档'}
            </div>
          </a>
        )}
      </div>
    </motion.div>
  )
}

function RevealSection({ children, className, id }: { children: ReactNode; className: string; id?: string }) {
  return (
    <motion.section
      className={className}
      id={id}
      initial={{ opacity: 0, y: 28 }}
      transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ amount: 0.12, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.section>
  )
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-black/10 pt-4 dark:border-white/10">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-2 text-sm font-semibold leading-6">{value}</dd>
    </div>
  )
}
