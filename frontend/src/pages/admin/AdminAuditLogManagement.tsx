import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Download,
  Eye,
  Filter,
  KeyRound,
  MonitorCog,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

type AuditLevel = '普通' | '重要' | '高风险'
type AuditModule = '漏洞管理' | '用户管理' | '证书管理' | '系统设置' | '积分商城' | '学习管理' | '认证登录'
type AuditResult = '成功' | '失败' | '已拦截'

type AuditLog = {
  id: string
  time: string
  module: AuditModule
  action: string
  actor: string
  role: string
  target: string
  ip: string
  device: string
  result: AuditResult
  level: AuditLevel
  summary: string
  detail: string
  before?: string
  after?: string
}

const moduleOptions = ['全部模块', '漏洞管理', '用户管理', '证书管理', '系统设置', '积分商城', '学习管理', '认证登录']
const levelOptions = ['全部等级', '普通', '重要', '高风险']
const resultOptions = ['全部结果', '成功', '失败', '已拦截']

const auditLogs: AuditLog[] = [
  {
    id: 'AUD-2026-0428-0018',
    time: '2026-04-28 10:28:13',
    module: '系统设置',
    action: '修改 AI 服务商',
    actor: '平台管理员',
    role: '管理员',
    target: 'AI 设置 / 服务商',
    ip: '10.10.1.8',
    device: 'Chrome 124 / Windows',
    result: '成功',
    level: '高风险',
    summary: '管理员将 AI 服务商从 OpenAI 兼容接口切换为学校私有模型。',
    detail: '该操作会影响漏洞报告智能解析、审核员价值预判、学习路线推荐和平台知识库问答。系统已要求二次确认。',
    before: 'OpenAI 兼容接口',
    after: '学校私有模型',
  },
  {
    id: 'AUD-2026-0428-0017',
    time: '2026-04-28 10:21:44',
    module: '用户管理',
    action: '调整用户角色',
    actor: '平台管理员',
    role: '管理员',
    target: '审核员 A',
    ip: '10.10.1.8',
    device: 'Chrome 124 / Windows',
    result: '成功',
    level: '重要',
    summary: '管理员调整用户角色，角色变更会影响菜单和数据访问范围。',
    detail: '角色调整弹窗已要求填写管理员备注，操作记录保留用于后续审计追踪。',
    before: '学生',
    after: '审核员',
  },
  {
    id: 'AUD-2026-0428-0016',
    time: '2026-04-28 10:15:09',
    module: '漏洞管理',
    action: '导出漏洞台账',
    actor: '平台管理员',
    role: '管理员',
    target: '当前筛选结果',
    ip: '10.10.1.8',
    device: 'Chrome 124 / Windows',
    result: '成功',
    level: '重要',
    summary: '管理员导出漏洞审核台账，敏感字段按默认策略脱敏。',
    detail: '导出范围为当前筛选结果，导出内容为审核详情，文件格式为 Excel。',
  },
  {
    id: 'AUD-2026-0428-0015',
    time: '2026-04-28 09:56:31',
    module: '认证登录',
    action: '后台登录失败',
    actor: '未知用户',
    role: '未认证',
    target: '管理员登录入口',
    ip: '172.16.9.42',
    device: 'Unknown Browser',
    result: '已拦截',
    level: '高风险',
    summary: '后台登录入口出现连续失败尝试，账号锁定策略已触发。',
    detail: '系统检测到 5 次连续失败登录，已临时阻断该来源继续尝试。',
  },
  {
    id: 'AUD-2026-0428-0014',
    time: '2026-04-28 09:42:20',
    module: '证书管理',
    action: '生成证书 PDF',
    actor: '审核员 B',
    role: '审核员',
    target: 'CERT-2026-0002',
    ip: '10.10.2.31',
    device: 'Edge 123 / Windows',
    result: '成功',
    level: '普通',
    summary: '审核员生成漏洞贡献电子证书 PDF。',
    detail: '证书 PDF 为线上电子证明，当前模板内容为最小可用版。',
  },
  {
    id: 'AUD-2026-0428-0013',
    time: '2026-04-28 09:31:18',
    module: '积分商城',
    action: '确认线下领取',
    actor: '平台管理员',
    role: '管理员',
    target: 'EX-2026-0017',
    ip: '10.10.1.8',
    device: 'Chrome 124 / Windows',
    result: '成功',
    level: '普通',
    summary: '管理员确认用户已在线下领取兑换商品。',
    detail: '兑换商品为漏洞证书精装打印服务，领取地点为网络安全学院办公室。',
  },
]

const levelStyles: Record<AuditLevel, string> = {
  普通: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  重要: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  高风险: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

const resultStyles: Record<AuditResult, string> = {
  成功: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  失败: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  已拦截: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

const moduleIcons: Record<AuditModule, typeof Activity> = {
  漏洞管理: ShieldAlert,
  用户管理: UserCog,
  证书管理: ShieldCheck,
  系统设置: MonitorCog,
  积分商城: Activity,
  学习管理: SearchCheck,
  认证登录: KeyRound,
}

export function AdminAuditLogManagement() {
  const [keyword, setKeyword] = useState('')
  const [module, setModule] = useState('全部模块')
  const [level, setLevel] = useState('全部等级')
  const [result, setResult] = useState('全部结果')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return auditLogs.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.action.toLowerCase().includes(normalizedKeyword) ||
        item.actor.toLowerCase().includes(normalizedKeyword) ||
        item.target.toLowerCase().includes(normalizedKeyword) ||
        item.ip.toLowerCase().includes(normalizedKeyword)
      const matchesModule = module === '全部模块' || item.module === module
      const matchesLevel = level === '全部等级' || item.level === level
      const matchesResult = result === '全部结果' || item.result === result

      return matchesKeyword && matchesModule && matchesLevel && matchesResult
    })
  }, [keyword, level, module, result])

  const selectedLog = selectedId ? auditLogs.find((item) => item.id === selectedId) ?? null : null

  if (selectedLog) {
    const Icon = moduleIcons[selectedLog.module]

    return (
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          onClick={() => setSelectedId(null)}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          返回审计日志
        </button>

        <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <SurfacePanel className="p-6 xl:sticky xl:top-24 xl:self-start">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-green-300">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{selectedLog.id}</p>
                <h1 className="mt-1 text-2xl font-semibold">{selectedLog.action}</h1>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <LevelBadge level={selectedLog.level} />
              <ResultBadge result={selectedLog.result} />
              <span className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">
                {selectedLog.module}
              </span>
            </div>
            <div className="mt-5 space-y-3 border-t border-black/10 pt-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              <p>操作人：{selectedLog.actor}</p>
              <p>角色：{selectedLog.role}</p>
              <p>目标：{selectedLog.target}</p>
              <p>时间：{selectedLog.time}</p>
              <p>来源 IP：{selectedLog.ip}</p>
              <p>设备：{selectedLog.device}</p>
            </div>
          </SurfacePanel>

          <div className="space-y-6">
            <SurfacePanel className="p-6">
              <h2 className="text-xl font-semibold">事件摘要</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">{selectedLog.summary}</p>
              <div className="mt-5 rounded-lg border border-black/10 bg-black/[0.025] p-4 text-sm leading-7 text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                {selectedLog.detail}
              </div>
            </SurfacePanel>

            {(selectedLog.before || selectedLog.after) && (
              <SurfacePanel className="p-6">
                <h2 className="text-xl font-semibold">变更对比</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <DiffBox label="变更前" value={selectedLog.before ?? '无'} />
                  <DiffBox label="变更后" value={selectedLog.after ?? '无'} />
                </div>
              </SurfacePanel>
            )}

            <SurfacePanel className="p-6">
              <h2 className="text-xl font-semibold">原始记录</h2>
              <pre className="mt-5 overflow-x-auto rounded-lg border border-black/10 bg-slate-950 p-4 text-sm leading-7 text-green-100 dark:border-white/10">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </SurfacePanel>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="Audit Logs"
          eyebrowIcon={<Activity className="h-3.5 w-3.5" />}
          title="审计日志"
          description="追踪管理员、审核员和系统关键操作，覆盖登录认证、数据导出、角色变更、系统配置和敏感业务处理。"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          type="button"
        >
          <Download className="h-4 w-4" />
          导出日志
        </button>
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px_150px_150px_auto] xl:items-end">
          <SearchInput
            label="搜索日志"
            onChange={setKeyword}
            placeholder="日志编号、操作、操作人、目标或 IP"
            value={keyword}
          />
          <SelectInput label="业务模块" onChange={setModule} options={moduleOptions} value={module} />
          <SelectInput label="风险等级" onChange={setLevel} options={levelOptions} value={level} />
          <SelectInput label="执行结果" onChange={setResult} options={resultOptions} value={result} />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => {
              setKeyword('')
              setModule('全部模块')
              setLevel('全部等级')
              setResult('全部结果')
            }}
            type="button"
          >
            <Filter className="h-4 w-4" />
            重置
          </button>
        </div>
      </SurfacePanel>

      <SurfacePanel className="mt-5 overflow-hidden p-0">
        <div className="grid grid-cols-[170px_minmax(0,1fr)_120px_120px_140px_100px] gap-4 border-b border-black/10 px-4 py-3 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span>时间</span>
          <span>事件</span>
          <span>模块</span>
          <span>操作人</span>
          <span>来源</span>
          <span className="text-right">操作</span>
        </div>

        <div className="divide-y divide-black/10 dark:divide-white/10">
          {filteredLogs.map((item) => {
            const Icon = moduleIcons[item.module]
            return (
              <div
                className="grid gap-4 px-4 py-3 text-sm transition hover:bg-black/[0.025] md:grid-cols-[170px_minmax(0,1fr)_120px_120px_140px_100px] md:items-center dark:hover:bg-white/[0.035]"
                key={item.id}
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <CalendarClock className="mb-1 h-4 w-4" />
                  {item.time}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.action}</span>
                    <LevelBadge level={item.level} />
                    <ResultBadge result={item.result} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{item.summary}</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{item.id}</p>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon className="h-4 w-4 text-brand-700 dark:text-green-300" />
                  {item.module}
                </div>
                <div>
                  <p>{item.actor}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.role}</p>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <p>{item.ip}</p>
                  <p className="mt-1 line-clamp-1">{item.device}</p>
                </div>
                <div className="text-right">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => setSelectedId(item.id)}
                    type="button"
                  >
                    <Eye className="h-4 w-4" />
                    详情
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </SurfacePanel>

      {filteredLogs.length === 0 && (
        <SurfacePanel className="mt-5 p-10 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-4 text-xl font-semibold">没有匹配的审计日志</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、模块、风险等级或执行结果后再试一次。</p>
        </SurfacePanel>
      )}
    </section>
  )
}

function LevelBadge({ level }: { level: AuditLevel }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${levelStyles[level]}`}>{level}</span>
}

function ResultBadge({ result }: { result: AuditResult }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${resultStyles[result]}`}>{result}</span>
}

function DiffBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}
