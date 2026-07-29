import { motion, useReducedMotion } from 'motion/react'
import { SpotlightCard } from '../ui/SpotlightCard'

const processItems = [
  {
    title: '注册账号',
    description: '使用统一认证码完成注册，建立个人身份、邮箱和平台账号关系。',
  },
  {
    title: '安全答题',
    description: '先了解授权边界、禁止行为和报告规范，确认具备基本参与条件。',
  },
  {
    title: '签署责任书',
    description: '明确测试范围、责任要求和行为约束，确保后续实践在合规范围内进行。',
  },
  {
    title: '提交漏洞',
    description: '按模板提交影响说明、复现步骤、证据材料和修复建议，便于审核复核。',
  },
  {
    title: '审核反馈',
    description: '审核人员评估风险等级、有效性和修复价值，必要时要求补充材料。',
  },
  {
    title: '积分与证书',
    description: '有效报告进入奖励流程，形成积分、证书和可验证的个人贡献记录。',
  },
]

export function SafetyParticipationFlow({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.section
      className={`relative z-10 mx-auto max-w-[1280px] px-5 py-24 md:px-8 ${className}`}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ amount: 0.12, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">安全参与流程</h2>
        <p className="mt-4 leading-8 text-slate-600 dark:text-slate-400">
          从账号准入到漏洞提交，再到审核反馈和成果沉淀，平台将安全实践拆解为清晰的连续步骤，降低参与门槛，也保证行为边界可控。
        </p>
      </div>

      <div className="mt-12 hidden overflow-x-auto pb-2 [scrollbar-width:none] md:block [&::-webkit-scrollbar]:hidden">
        <div className="grid min-w-[1040px] grid-cols-6 border-b border-black/10 dark:border-white/10">
          {processItems.map((item, index) => (
            <SpotlightCard
              className={`guest-hover-surface guest-process-item relative flex min-h-[210px] flex-col px-5 py-7 ${
                index < processItems.length - 1 ? 'border-r border-black/10 dark:border-white/10' : ''
              }`}
              key={item.title}
              spotlightColor="color-mix(in srgb, var(--guest-accent) 20%, transparent)"
            >
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center gap-3">
                  <span className="guest-palette-label font-mono text-sm font-semibold">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="guest-palette-rule h-px flex-1" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-400">{item.description}</p>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>

      <div className="mt-8 md:hidden">
        {processItems.map((item, index) => (
          <SpotlightCard
            className="guest-hover-surface guest-process-item border-b border-black/10 px-3 py-6 dark:border-white/10"
            key={item.title}
            spotlightColor="color-mix(in srgb, var(--guest-accent) 20%, transparent)"
          >
            <div className="relative z-10">
              <div className="guest-palette-label font-mono text-sm font-semibold">
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-400">{item.description}</p>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </motion.section>
  )
}
