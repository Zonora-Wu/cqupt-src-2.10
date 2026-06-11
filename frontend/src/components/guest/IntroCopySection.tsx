import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { InteractivePretextParagraph } from '../ui/InteractivePretextParagraph'
import { usePretextBlockMetrics } from '../../hooks/usePretextBlockMetrics'

const introParagraphs = [
  {
    zh: 'CQUPT-SRC 是面向校园网络安全建设的漏洞响应与安全学习平台，连接学生、学院、信息化部门与校园资产责任单位，构建从漏洞提交、分级审核、修复跟进、复测归档到积分与证书激励的全链路协同体系。它不以“收集漏洞”为终点，而是希望让每一个有效风险都能被规范记录、及时响应、持续跟踪，并最终沉淀为学校安全治理和学生能力成长的一部分。',
    en: 'CQUPT-SRC is a vulnerability response and security learning platform built for campus cybersecurity development. It connects students, the School, information technology departments, and campus asset owners, forming a full-chain collaborative system that covers vulnerability submission, severity review, remediation tracking, retesting and archiving, as well as points and certificate-based incentives. Its goal is not simply to “collect vulnerabilities,” but to ensure that every valid risk can be properly recorded, promptly responded to, continuously followed up, and eventually transformed into part of the University’s security governance and students’ capability growth.',
    zhClass: 'text-justify text-lg font-medium leading-9 text-slate-800 [text-indent:2em] dark:text-slate-200',
    enClass: 'text-justify text-[14px] leading-[1.58] text-slate-700 [text-indent:2em] dark:text-slate-300',
  },
  {
    zh: '在这里，同学可以在合法授权的范围内参与真实安全实践，获取工具资源，进入靶场训练，提交校园网络资产中的有效漏洞，并通过审核反馈、积分奖励和漏洞证书获得正向激励；审核员和管理者可以借助平台完成漏洞分级、价值判断、修复协同、复测归档、审计追踪和数据分析，让校园安全工作从零散沟通走向体系化运营。',
    en: 'Here, students can participate in real-world security practice within a lawful and authorized scope. They can access security tools and learning resources, train in cyber ranges, submit valid vulnerabilities found in campus network assets, and receive positive incentives through review feedback, points rewards, and vulnerability certificates. Reviewers and administrators can use the platform to complete vulnerability classification, value assessment, remediation coordination, retesting, archiving, audit tracing, and data analysis, enabling campus security work to move from fragmented communication toward systematic operation.',
    zhClass: 'text-justify text-lg leading-9 text-slate-600 [text-indent:2em] dark:text-slate-400',
    enClass: 'text-justify text-[14px] leading-[1.58] text-slate-600 [text-indent:2em] dark:text-slate-500',
  },
  {
    zh: '这不只是一个漏洞提交入口，也不只是一个安全学习网站，而是一个以平台驱动网络安全教育、产教融合、人才发现与校园安全治理共同发展的长期系统。它希望让学生在真实场景中建立规则意识与工程能力，让学院获得可观测的人才培养数据，让学校补足漏洞响应与安全建设能力，最终形成可复制、可持续的高校网络安全产教融合实践案例。',
    en: 'CQUPT-SRC is more than a vulnerability submission portal, and more than a security learning website. It is a long-term system that uses a platform-based approach to jointly promote cybersecurity education, industry-education integration, talent discovery, and campus security governance. It aims to help students build rule awareness and engineering capabilities in real scenarios, provide the School with observable data for talent cultivation, strengthen the University’s vulnerability response and security construction capabilities, and ultimately form a replicable and sustainable model of cybersecurity industry-education integration in higher education.',
    zhClass: 'text-justify text-lg leading-9 text-slate-600 [text-indent:2em] dark:text-slate-400',
    enClass: 'text-justify text-[14px] leading-[1.58] text-slate-600 [text-indent:2em] dark:text-slate-500',
  },
]

export function IntroCopySection() {
  const { clearPointer, handlePointerLeave, handlePointerMove, pointer } = useRafPointer()

  return (
    <section
      className="relative z-10 mx-auto max-w-6xl border-t border-black/[0.08] px-5 py-20 md:px-8 dark:border-white/[0.06]"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onWheel={clearPointer}
    >
      <div className="grid gap-x-20 gap-y-8 lg:grid-cols-2">
        <div className="h-1 w-12 rounded-lg bg-brand-600" />
        <div className="hidden h-1 w-12 rounded-lg bg-slate-700 lg:block" />
        {introParagraphs.map((paragraph) => (
          <div className="contents" key={paragraph.zh}>
            <MeasuredParagraph className={paragraph.zhClass} locale="zh-CN" pointer={pointer} text={paragraph.zh} />
            <MeasuredParagraph className={paragraph.enClass} locale="en-US" pointer={pointer} text={paragraph.en} />
          </div>
        ))}
      </div>
    </section>
  )
}

function useRafPointer() {
  const frameRef = useRef<number | null>(null)
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  const clearPointer = useCallback(() => {
    pendingPointerRef.current = null
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    setPointer(null)
  }, [])

  const flushPointer = useCallback(() => {
    frameRef.current = null
    setPointer(pendingPointerRef.current)
  }, [])

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      pendingPointerRef.current = { x: event.clientX, y: event.clientY }
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(flushPointer)
      }
    },
    [flushPointer],
  )

  const handlePointerLeave = useCallback(() => {
    clearPointer()
  }, [clearPointer])

  useEffect(() => {
    window.addEventListener('scroll', clearPointer, { passive: true })

    return () => {
      window.removeEventListener('scroll', clearPointer)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [clearPointer])

  return { clearPointer, handlePointerLeave, handlePointerMove, pointer }
}

function MeasuredParagraph({
  className,
  locale,
  pointer,
  text,
}: {
  className: string
  locale: string
  pointer: { x: number; y: number } | null
  text: string
}) {
  const { metrics, ref } = usePretextBlockMetrics<HTMLParagraphElement>(text, { locale })

  return (
    <div data-pretext-height={Math.round(metrics.height)} data-pretext-lines={metrics.lineCount} ref={ref}>
      <InteractivePretextParagraph className={className} locale={locale} pointer={pointer} text={text} />
    </div>
  )
}
