import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileSearch,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SeverityBadge } from '../../components/ui/SeverityBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

const statusOptions = ['全部状态', '草稿', '待审核', '审核中', '待补充', '已确认', '修复中', '已归档']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危']

const vulnerabilityStats = [
  { label: '累计提交', value: '8', hint: '漏洞报告', icon: FileSearch },
  { label: '待处理', value: '3', hint: '审核或补充中', icon: Clock3 },
  { label: '已确认', value: '5', hint: '通过审核', icon: ShieldCheck },
  { label: '需补充', value: '1', hint: '等待完善材料', icon: AlertTriangle },
]

const vulnerabilities = [
  {
    id: 'SRC-2026-0008',
    title: '统一认证入口弱口令策略绕过风险',
    asset: 'auth.cqupt.edu.cn',
    department: '信息化办公室',
    level: '高危',
    status: '待补充',
    points: 0,
    submittedAt: '2026-04-27 10:24',
    updatedAt: '2026-04-27 14:36',
    aiTip: '建议补充影响账号范围、复现边界说明和修复前不得公开传播承诺。',
  },
  {
    id: 'SRC-2026-0007',
    title: '实验教学平台越权访问课程附件',
    asset: 'lab.cqupt.edu.cn',
    department: '教务处',
    level: '中危',
    status: '审核中',
    points: 0,
    submittedAt: '2026-04-26 21:18',
    updatedAt: '2026-04-27 09:12',
    aiTip: 'AI 判断复现步骤完整，建议等待审核员核实资产责任单位。',
  },
  {
    id: 'SRC-2026-0006',
    title: '校园门户接口敏感信息返回过多',
    asset: 'portal.cqupt.edu.cn/api/user',
    department: '信息化办公室',
    level: '中危',
    status: '已确认',
    points: 260,
    submittedAt: '2026-04-24 16:42',
    updatedAt: '2026-04-26 11:30',
    aiTip: '已确认有效，后续可关注修复复测任务。',
  },
  {
    id: 'SRC-2026-0005',
    title: '学生社团系统后台登录验证码复用',
    asset: 'club.cqupt.edu.cn',
    department: '团委',
    level: '低危',
    status: '已归档',
    points: 80,
    submittedAt: '2026-04-21 13:08',
    updatedAt: '2026-04-25 17:22',
    aiTip: '已完成归档，可在证书规则满足后申请贡献证明。',
  },
  {
    id: 'SRC-2026-0004',
    title: '在线靶场资源下载链接未鉴权',
    asset: 'range.cqupt-src.edu.cn',
    department: '网络安全学院',
    level: '高危',
    status: '修复中',
    points: 360,
    submittedAt: '2026-04-18 09:40',
    updatedAt: '2026-04-22 10:16',
    aiTip: '建议复测时重点验证历史临时链接是否仍可访问。',
  },
]



export function UserMyVulnerabilities() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')

  const filteredVulnerabilities = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return vulnerabilities.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.asset.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesLevel = level === '全部等级' || item.level === level

      return matchesKeyword && matchesStatus && matchesLevel
    })
  }, [keyword, level, status])

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="My Reports"
          eyebrowIcon={<ShieldAlert className="h-3.5 w-3.5" />}
          title="我的漏洞"
          description="查看你提交的漏洞报告、审核状态、积分奖励和 AI 材料建议，按流程完成补充、复测与归档。"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          type="button"
        >
          <FileSearch className="h-4 w-4" />
          查看提交规范
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {vulnerabilityStats.map((item) => {
          const Icon = item.icon
          return (
            <SurfacePanel className="p-5" key={item.label}>
              <div className="flex items-start justify-between gap-4">
                <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                <span className="text-3xl font-semibold">{item.value}</span>
              </div>
              <p className="mt-3 text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
            </SurfacePanel>
          )
        })}
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
          <SearchInput
            label="搜索漏洞"
            onChange={setKeyword}
            placeholder="输入漏洞编号、标题或影响资产"
            value={keyword}
          />
          <SelectInput label="审核状态" onChange={setStatus} options={statusOptions} value={status} />
          <SelectInput label="风险等级" onChange={setLevel} options={levelOptions} value={level} />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => {
              setKeyword('')
              setStatus('全部状态')
              setLevel('全部等级')
            }}
            type="button"
          >
            <Filter className="h-4 w-4" />
            重置
          </button>
        </div>
      </SurfacePanel>

      <div className="mt-6 grid gap-5">
        {filteredVulnerabilities.map((item) => (
          <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                  <SeverityBadge level={item.level as import('../../utils/severity').SeverityLevel} />
                  <StatusBadge status={item.status as import('../../utils/vulnStatus').VulnStatus} />
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.title}</h2>
                <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                  <p>影响资产：{item.asset}</p>
                  <p>责任单位：{item.department}</p>
                  <p>提交时间：{item.submittedAt}</p>
                  <p>最近更新：{item.updatedAt}</p>
                </div>
              </div>

              <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-brand-700 dark:text-green-300" />
                    AI 建议
                  </div>
                  <span className="text-sm font-semibold text-brand-700 dark:text-green-300">+{item.points}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.aiTip}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CalendarClock className="h-4 w-4" />
                流程节点将根据审核员操作自动更新
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  type="button"
                >
                  查看详情
                </button>
                <button
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                  type="button"
                >
                  {item.status === '待补充' ? '补充材料' : '查看进度'}
                </button>
              </div>
            </div>
          </SurfacePanel>
        ))}

        {filteredVulnerabilities.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="没有匹配的漏洞报告"
            description="调整关键词或筛选条件后再试一次。"
          />
        )}
      </div>
    </PageSection>
  )
}
