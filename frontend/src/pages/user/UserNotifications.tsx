import {
  Award,
  Bell,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'

/* ─── 数据类型 ─── */
type MessageItem = {
  id: string
  content: string
  time: string
  dateLabel?: string // 日期分隔符
}

type Conversation = {
  id: string
  title: string
  icon: React.ReactNode
  iconBg: string
  lastMessage: string
  lastTime: string
  unread: number
  messages: MessageItem[]
}

/* ─── 模拟数据 ─── */
const conversations: Conversation[] = [
  {
    id: 'audit',
    title: '漏洞审核通知',
    icon: <ShieldCheck className="h-5 w-5" />,
    iconBg: 'bg-brand-600',
    lastMessage: '你提交的「弱口令风险报告」已通过审核，获得 120 积分。',
    lastTime: '10:24',
    unread: 2,
    messages: [
      { id: 'm1', dateLabel: '2026-04-25', content: '', time: '' },
      {
        id: 'm2',
        content: '你提交的漏洞报告「学生选课系统 XSS 注入」已进入审核流程，预计 1-3 个工作日内完成审核。',
        time: '09:15',
      },
      {
        id: 'm3',
        content:
          '你提交的漏洞报告「学生选课系统 XSS 注入」已通过初审。审核员正在进行复现验证，请保持联系方式畅通。',
        time: '16:40',
      },
      { id: 'm4', dateLabel: '2026-04-26', content: '', time: '' },
      {
        id: 'm5',
        content:
          '【漏洞审核结果】报告「学生选课系统 XSS 注入」审核通过，评定等级：中危，奖励积分：80。感谢你的安全贡献！',
        time: '11:02',
      },
      { id: 'm6', dateLabel: '2026-04-27', content: '', time: '' },
      {
        id: 'm7',
        content: '你提交的「弱口令风险报告」已通过审核，评定等级：低危，奖励积分：120。',
        time: '10:24',
      },
      {
        id: 'm8',
        content:
          '提示：你的报告「图书馆系统越权访问」缺少完整复现截图，审核已暂停。请在 3 日内补充材料，否则将关闭该报告。',
        time: '10:36',
      },
    ],
  },
  {
    id: 'points',
    title: '积分变动',
    icon: <Award className="h-5 w-5" />,
    iconBg: 'bg-amber-500',
    lastMessage: '兑换「Web 安全工具包」成功，扣除 200 积分，当前余额 1060。',
    lastTime: '昨天',
    unread: 0,
    messages: [
      { id: 'p1', dateLabel: '2026-04-20', content: '', time: '' },
      { id: 'p2', content: '系统奖励：完成「SQL 注入基础靶场」，获得 50 积分，当前余额：980。', time: '14:20' },
      { id: 'p3', dateLabel: '2026-04-26', content: '', time: '' },
      { id: 'p4', content: '漏洞审核奖励：「学生选课系统 XSS 注入」通过审核，获得 80 积分，当前余额：1260。', time: '11:03' },
      {
        id: 'p5',
        content: '兑换「Web 安全工具包」成功，扣除 200 积分，当前余额：1060。请前往学习中心查看资源。',
        time: '15:48',
      },
    ],
  },
  {
    id: 'system',
    title: '系统通知',
    icon: <Bell className="h-5 w-5" />,
    iconBg: 'bg-slate-500',
    lastMessage: '你的账号已于今日 08:32 在重庆邮电大学校园网登录。',
    lastTime: '今天',
    unread: 1,
    messages: [
      { id: 's1', dateLabel: '2026-04-01', content: '', time: '' },
      {
        id: 's2',
        content: '欢迎加入 CQUPT-SRC！请尽快完成责任书签署，签署后方可提交漏洞报告。',
        time: '10:00',
      },
      { id: 's3', dateLabel: '2026-04-27', content: '', time: '' },
      {
        id: 's4',
        content: '你的账号已于今日 08:32 在重庆邮电大学校园网登录成功。如非本人操作，请立即修改密码并联系管理员。',
        time: '08:32',
      },
    ],
  },
  {
    id: 'announcement',
    title: '平台公告',
    icon: <Megaphone className="h-5 w-5" />,
    iconBg: 'bg-blue-500',
    lastMessage: '关于规范漏洞报告附件提交格式的通知已发布，请注意阅读。',
    lastTime: '2026/4/27',
    unread: 0,
    messages: [
      { id: 'a1', dateLabel: '2026-04-24', content: '', time: '' },
      { id: 'a2', content: '【平台公告】新增权限控制专题靶场资源，适合完成 Web 基础训练后的同学继续练习。请前往学习中心查看。', time: '09:00' },
      { id: 'a3', dateLabel: '2026-04-26', content: '', time: '' },
      { id: 'a4', content: '【平台公告】五一期间漏洞审核与复测安排：假期期间平台可正常提交漏洞，审核与复测响应时间可能顺延。', time: '10:00' },
      { id: 'a5', dateLabel: '2026-04-27', content: '', time: '' },
      { id: 'a6', content: '【平台公告】关于规范漏洞报告附件提交格式的通知：漏洞报告附件建议使用 PDF 格式，截图需去除无关个人信息，敏感数据必须脱敏展示。', time: '08:00' },
    ],
  },
]

/* ─── 主组件 ─── */
export function UserNotifications() {
  const [activeId, setActiveId] = useState(conversations[0].id)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]

  const handleSelect = (id: string) => {
    setActiveId(id)
    setReadIds((prev) => new Set([...prev, id]))
  }

  return (
    <section className="relative z-10 mx-auto flex max-w-[1180px] gap-0 px-5 pb-8 pt-24 md:px-8">
      <div className="flex h-[calc(100vh-7rem)] w-full overflow-hidden rounded-lg border border-black/10 bg-white/75 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">

        {/* 左侧会话列表 */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-black/10 dark:border-white/10">
          {/* 顶栏 */}
          <div className="flex h-14 items-center gap-2 border-b border-black/10 px-4 dark:border-white/10">
            <MessageSquare className="h-4 w-4 text-brand-600 dark:text-green-300" />
            <span className="text-sm font-semibold">通知中心</span>
          </div>

          {/* 会话列表 */}
          <div className="flex-1 overflow-y-auto py-1">
            {conversations.map((conv) => {
              const isActive = conv.id === activeId
              const isUnread = conv.unread > 0 && !readIds.has(conv.id)
              return (
                <button
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition ${
                    isActive
                      ? 'bg-brand-600/10 dark:bg-green-300/10'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  type="button"
                >
                  {/* 头像 */}
                  <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${conv.iconBg}`}>
                    {conv.icon}
                    {isUnread && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {conv.unread}
                      </span>
                    )}
                  </div>

                  {/* 文字 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${isActive ? 'text-brand-700 dark:text-green-300' : ''}`}>
                        {conv.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                        {conv.lastTime}
                      </span>
                    </div>
                    <p className={`mt-0.5 truncate text-xs ${isUnread ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                      {conv.lastMessage}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* 右侧消息内容 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 顶栏 */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-black/10 px-5 dark:border-white/10">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${active.iconBg}`}>
              <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{active.icon}</span>
            </div>
            <span className="text-sm font-semibold">{active.title}</span>
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">所有消息均由系统自动发送</span>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mx-auto max-w-2xl space-y-1">
              {active.messages.map((msg) => {
                if (msg.dateLabel) {
                  return (
                    <div className="flex items-center gap-3 py-3" key={msg.id}>
                      <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{msg.dateLabel}</span>
                      <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                    </div>
                  )
                }
                return (
                  <MessageBubble
                    content={msg.content}
                    icon={active.icon}
                    iconBg={active.iconBg}
                    key={msg.id}
                    time={msg.time}
                    title={active.title}
                  />
                )
              })}
            </div>
          </div>

          {/* 底部提示 */}
          <div className="shrink-0 border-t border-black/10 px-5 py-3 dark:border-white/10">
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              通知由系统自动发送，无需回复。如有问题请联系管理员。
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── 消息气泡 ─── */
function MessageBubble({
  content,
  icon,
  iconBg,
  time,
  title,
}: {
  content: string
  icon: React.ReactNode
  iconBg: string
  time: string
  title: string
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      {/* 头像 */}
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white [&>svg]:h-4 [&>svg]:w-4 ${iconBg}`}>
        {icon}
      </div>

      {/* 气泡 */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{title}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{time}</span>
        </div>
        <div className="mt-1 max-w-lg rounded-lg rounded-tl-sm bg-black/[0.04] px-3.5 py-2.5 text-sm leading-6 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
          {content}
        </div>
      </div>
    </div>
  )
}
