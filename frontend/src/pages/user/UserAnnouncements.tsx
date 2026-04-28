import { ArrowLeft, Bell, CalendarClock, Megaphone, Pin, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

const categoryOptions = ['全部公告', '平台通知', '规则更新', '安全提醒', '活动通知']

const announcements = [
  {
    id: 'ANN-2026-004',
    title: '关于规范漏洞报告附件提交格式的通知',
    category: '规则更新',
    date: '2026-04-27',
    pinned: true,
    summary: '漏洞报告附件建议使用 PDF 格式，截图需去除无关个人信息，敏感数据必须脱敏展示。',
    content:
      '为提升审核效率并保护敏感数据，平台建议漏洞报告附件统一使用 PDF 格式。复现截图中如包含账号、姓名、手机号、Token、Cookie 等敏感信息，应进行脱敏处理。禁止在附件中上传未授权获取的数据包、数据库导出文件或大规模扫描结果。',
  },
  {
    id: 'ANN-2026-003',
    title: '五一期间漏洞审核与复测安排',
    category: '平台通知',
    date: '2026-04-26',
    pinned: true,
    summary: '假期期间平台可正常提交漏洞，审核与复测响应时间可能顺延。',
    content:
      '五一假期期间，CQUPT-SRC 平台漏洞提交功能正常开放。审核员将保持值守，但部分资产责任单位修复反馈时间可能顺延。涉及高危风险的报告请保持联系方式畅通，平台将优先协调处理。',
  },
  {
    id: 'ANN-2026-002',
    title: '新增权限控制专题靶场资源',
    category: '活动通知',
    date: '2026-04-24',
    pinned: false,
    summary: '学习中心已新增权限控制专题靶场，适合完成 Web 基础训练后的同学继续练习。',
    content:
      '学习中心新增权限控制专题靶场，覆盖水平越权、垂直越权、接口鉴权缺失等常见场景。请注意靶场训练与真实资产测试的边界差异，真实校园资产测试必须在授权范围内进行。',
  },
  {
    id: 'ANN-2026-001',
    title: '漏洞修复前不得公开传播风险细节',
    category: '安全提醒',
    date: '2026-04-21',
    pinned: false,
    summary: '漏洞提交后，在平台确认修复与归档前，不得在公开渠道传播漏洞细节。',
    content:
      '为保护校园网络资产安全，漏洞提交者在漏洞修复与归档前不得通过社交媒体、公开仓库、群聊截图等方式传播漏洞细节、复现步骤、利用脚本或敏感数据。违反平台规则的，将影响积分、证书和后续提交资格。',
  },
]

const categoryStyles: Record<string, string> = {
  平台通知: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  规则更新: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  安全提醒: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  活动通知: 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300',
}

export function UserAnnouncements() {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部公告')
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<(typeof announcements)[number] | null>(null)

  const filteredAnnouncements = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return announcements.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.summary.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword)
      const matchesCategory = category === '全部公告' || item.category === category

      return matchesKeyword && matchesCategory
    })
  }, [category, keyword])

  if (selectedAnnouncement) {
    return (
      <PageSection>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          onClick={() => setSelectedAnnouncement(null)}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          返回公告列表
        </button>

        <article className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <SurfacePanel className="p-5 lg:sticky lg:top-24">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[selectedAnnouncement.category]}`}>
                {selectedAnnouncement.category}
              </span>
              {selectedAnnouncement.pinned && (
                <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
                  <Pin className="h-3.5 w-3.5" />
                  置顶
                </span>
              )}
            </div>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{selectedAnnouncement.title}</h1>

            <div className="mt-5 space-y-3 border-t border-black/10 pt-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              <p className="font-mono text-xs">{selectedAnnouncement.id}</p>
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                {selectedAnnouncement.date}
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="text-sm font-medium">概要</p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{selectedAnnouncement.summary}</p>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>涉及漏洞细节、敏感信息和测试边界的内容，请以平台规则和审核员要求为准。</p>
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel className="p-6 md:p-8">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">详细原文</p>
            <div className="mt-5 whitespace-pre-line text-base leading-8 text-slate-700 dark:text-slate-300">
              {selectedAnnouncement.content}
            </div>
          </SurfacePanel>
        </article>
      </PageSection>
    )
  }

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="Announcements"
          eyebrowIcon={<Megaphone className="h-3.5 w-3.5" />}
          title="平台公告"
          description="查看平台通知、规则更新、安全提醒和学习活动安排，及时了解漏洞提交与审核流程变化。"
        />
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
          <SearchInput
            label="搜索公告"
            onChange={setKeyword}
            placeholder="输入公告标题、编号或关键词"
            value={keyword}
          />
          <SelectInput label="公告分类" onChange={setCategory} options={categoryOptions} value={category} />
        </div>
      </SurfacePanel>

      <div className="mt-6 grid gap-4">
        {filteredAnnouncements.map((item) => (
          <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[item.category]}`}>{item.category}</span>
                  {item.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
                      <Pin className="h-3.5 w-3.5" />
                      置顶
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.summary}</p>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <CalendarClock className="h-4 w-4" />
                  {item.date}
                </p>
              </div>
              <button
                className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                onClick={() => setSelectedAnnouncement(item)}
                type="button"
              >
                查看详情
              </button>
            </div>
          </SurfacePanel>
        ))}

        {filteredAnnouncements.length === 0 && (
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title="没有匹配的公告"
            description="调整关键词或公告分类后再试一次。"
          />
        )}
      </div>
    </PageSection>
  )
}
