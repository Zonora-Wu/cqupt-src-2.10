import {
  AlertTriangle,
  BookOpen,
  Edit3,
  Eye,
  Filter,
  GraduationCap,
  Layers3,
  Link2,
  Plus,
  Power,
  Target,
  Upload,
  X,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

type LearningTab = '资源管理' | '靶场管理'
type ItemStatus = '已上架' | '草稿' | '已下架'
type Difficulty = '入门' | '进阶' | '实战'

type ResourceItem = {
  id: string
  title: string
  category: '工具下载' | '学习资料'
  status: ItemStatus
  difficulty: Difficulty
  owner: string
  size: string
  downloads: number
  updatedAt: string
  description: string
  tags: string[]
}

type RangeItem = {
  id: string
  title: string
  type: 'Web 靶场' | '权限控制' | '漏洞复测' | '综合实战'
  status: ItemStatus
  difficulty: Difficulty
  environment: '在线环境' | 'Docker 镜像' | '校内专用'
  owner: string
  participants: number
  updatedAt: string
  description: string
  tags: string[]
}

type ConfirmAction = {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
} | null

const statusOptions = ['全部状态', '已上架', '草稿', '已下架']
const difficultyOptions = ['全部难度', '入门', '进阶', '实战']
const resourceCategoryOptions = ['全部类型', '工具下载', '学习资料']
const rangeTypeOptions = ['全部类型', 'Web 靶场', '权限控制', '漏洞复测', '综合实战']

const resources: ResourceItem[] = [
  {
    id: 'RES-2026-001',
    title: 'Web 漏洞测试基础工具包',
    category: '工具下载',
    status: '已上架',
    difficulty: '入门',
    owner: '平台管理员',
    size: '128 MB',
    downloads: 246,
    updatedAt: '2026-04-24',
    description: '包含请求重放、目录枚举、编码转换、弱口令自查等常用工具说明与下载入口。',
    tags: ['Web', '工具', '基础'],
  },
  {
    id: 'RES-2026-002',
    title: 'CQUPT-SRC 漏洞提交规范手册',
    category: '学习资料',
    status: '已上架',
    difficulty: '入门',
    owner: '审核员 A',
    size: '3.6 MB',
    downloads: 318,
    updatedAt: '2026-04-22',
    description: '说明漏洞报告结构、复现材料边界、敏感数据处理方式和禁止行为。',
    tags: ['规范', '报告', '边界'],
  },
  {
    id: 'RES-2026-003',
    title: '日志分析与漏洞复测辅助工具',
    category: '工具下载',
    status: '草稿',
    difficulty: '实战',
    owner: '审核员 B',
    size: '56 MB',
    downloads: 0,
    updatedAt: '2026-04-28',
    description: '面向复测阶段的请求记录整理、时间线生成和修复前后差异对比。',
    tags: ['日志', '复测', '分析'],
  },
]

const ranges: RangeItem[] = [
  {
    id: 'RANGE-2026-001',
    title: '权限控制与越权漏洞训练靶场',
    type: '权限控制',
    status: '已上架',
    difficulty: '进阶',
    environment: '在线环境',
    owner: '网络安全学院',
    participants: 128,
    updatedAt: '2026-04-20',
    description: '覆盖水平越权、垂直越权、接口鉴权缺失和越权复测方法。',
    tags: ['越权', '接口', '靶场'],
  },
  {
    id: 'RANGE-2026-002',
    title: 'SQL 注入基础到利用证明训练',
    type: 'Web 靶场',
    status: '已上架',
    difficulty: '入门',
    environment: '在线环境',
    owner: '网络安全学院',
    participants: 96,
    updatedAt: '2026-04-18',
    description: '从参数识别、报错判断到安全证明材料整理，强调不下载、不破坏数据。',
    tags: ['SQLi', '复现', '证明'],
  },
  {
    id: 'RANGE-2026-003',
    title: '校园门户敏感信息返回复测场景',
    type: '漏洞复测',
    status: '草稿',
    difficulty: '实战',
    environment: '校内专用',
    owner: '信息化办公室',
    participants: 0,
    updatedAt: '2026-04-28',
    description: '用于训练接口字段最小化、复测记录整理和修复前后响应对比。',
    tags: ['复测', '接口', '数据最小化'],
  },
]

const statusClassMap: Record<ItemStatus, string> = {
  已上架: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  草稿: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  已下架: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

const difficultyClassMap: Record<Difficulty, string> = {
  入门: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  进阶: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  实战: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export function AdminLearningManagement() {
  const [activeTab, setActiveTab] = useState<LearningTab>('资源管理')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [difficulty, setDifficulty] = useState('全部难度')
  const [type, setType] = useState('全部类型')
  const [editingItem, setEditingItem] = useState<ResourceItem | RangeItem | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionDone, setActionDone] = useState('')

  const filteredResources = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return resources.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword))
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesDifficulty = difficulty === '全部难度' || item.difficulty === difficulty
      const matchesType = type === '全部类型' || item.category === type

      return matchesKeyword && matchesStatus && matchesDifficulty && matchesType
    })
  }, [difficulty, keyword, status, type])

  const filteredRanges = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return ranges.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword))
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesDifficulty = difficulty === '全部难度' || item.difficulty === difficulty
      const matchesType = type === '全部类型' || item.type === type

      return matchesKeyword && matchesStatus && matchesDifficulty && matchesType
    })
  }, [difficulty, keyword, status, type])

  const completeAction = (message: string) => {
    setActionDone(message)
    window.setTimeout(() => setActionDone(''), 2200)
  }

  const resetFilters = () => {
    setKeyword('')
    setStatus('全部状态')
    setDifficulty('全部难度')
    setType('全部类型')
  }

  return (
    <>
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Learning Ops"
            eyebrowIcon={<GraduationCap className="h-3.5 w-3.5" />}
            title="学习管理"
            description="统一管理工具资源、学习资料和靶场内容，支持资源上架、草稿编辑、下架和 AI 学习推荐数据维护。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() =>
              setEditingItem(
                activeTab === '资源管理'
                  ? {
                      id: 'RES-2026-NEW',
                      title: '',
                      category: '学习资料',
                      status: '草稿',
                      difficulty: '入门',
                      owner: '平台管理员',
                      size: '待上传',
                      downloads: 0,
                      updatedAt: '2026-04-28',
                      description: '',
                      tags: [],
                    }
                  : {
                      id: 'RANGE-2026-NEW',
                      title: '',
                      type: 'Web 靶场',
                      status: '草稿',
                      difficulty: '入门',
                      environment: '在线环境',
                      owner: '网络安全学院',
                      participants: 0,
                      updatedAt: '2026-04-28',
                      description: '',
                      tags: [],
                    },
              )
            }
            type="button"
          >
            <Plus className="h-4 w-4" />
            {activeTab === '资源管理' ? '新增资源' : '新增靶场'}
          </button>
        </div>

        {actionDone && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {actionDone}
          </div>
        )}

        <SurfacePanel className="mt-6 p-2">
          <div className="grid gap-2 md:grid-cols-2">
            {(['资源管理', '靶场管理'] as LearningTab[]).map((tab) => (
              <button
                className={`rounded-lg px-4 py-3 text-left transition ${
                  activeTab === tab
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  resetFilters()
                }}
                type="button"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {tab === '资源管理' ? <Layers3 className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                  {tab}
                </span>
                <span className={`mt-1 block text-xs ${activeTab === tab ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
                  {tab === '资源管理' ? '管理工具下载与学习资料' : '管理在线靶场与训练环境'}
                </span>
              </button>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="relative z-30 mt-5 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px_160px_180px_auto] xl:items-end">
            <SearchInput
              label={activeTab === '资源管理' ? '搜索资源' : '搜索靶场'}
              onChange={setKeyword}
              placeholder="编号、标题、描述或标签"
              value={keyword}
            />
            <SelectInput
              label={activeTab === '资源管理' ? '资源类型' : '靶场类型'}
              onChange={setType}
              options={activeTab === '资源管理' ? resourceCategoryOptions : rangeTypeOptions}
              value={type}
            />
            <SelectInput label="状态" onChange={setStatus} options={statusOptions} value={status} />
            <SelectInput label="难度" onChange={setDifficulty} options={difficultyOptions} value={difficulty} />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={resetFilters}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
        </SurfacePanel>

        <div className="mt-5 grid gap-3">
          {activeTab === '资源管理'
            ? filteredResources.map((item) => (
                <LearningRow
                  key={item.id}
                  leftIcon={<BookOpen className="h-5 w-5" />}
                  meta={[
                    `类型：${item.category}`,
                    `大小：${item.size}`,
                    `下载：${item.downloads}`,
                    `负责人：${item.owner}`,
                    `更新：${item.updatedAt}`,
                  ]}
                  onEdit={() => setEditingItem(item)}
                  onToggleStatus={() =>
                    setConfirmAction({
                      title: item.status === '已上架' ? '确认下架资源？' : '确认上架资源？',
                      description:
                        item.status === '已上架'
                          ? `下架后，学生将无法在学习中心下载「${item.title}」。历史下载记录仍会保留。`
                          : `上架后，学生可在学习中心看到并下载「${item.title}」。请确认文件来源和内容合规。`,
                      danger: item.status === '已上架',
                      confirmLabel: item.status === '已上架' ? '确认下架' : '确认上架',
                      onConfirm: () => completeAction(item.status === '已上架' ? '资源已下架' : '资源已上架'),
                    })
                  }
                  primaryActionLabel={item.status === '已上架' ? '下架' : '上架'}
                  tags={item.tags}
                  title={item.title}
                  description={item.description}
                  difficulty={item.difficulty}
                  status={item.status}
                  id={item.id}
                />
              ))
            : filteredRanges.map((item) => (
                <LearningRow
                  key={item.id}
                  leftIcon={<Target className="h-5 w-5" />}
                  meta={[
                    `类型：${item.type}`,
                    `环境：${item.environment}`,
                    `参与：${item.participants}`,
                    `负责人：${item.owner}`,
                    `更新：${item.updatedAt}`,
                  ]}
                  onEdit={() => setEditingItem(item)}
                  onToggleStatus={() =>
                    setConfirmAction({
                      title: item.status === '已上架' ? '确认下架靶场？' : '确认上架靶场？',
                      description:
                        item.status === '已上架'
                          ? `下架后，学生将无法从学习中心进入「${item.title}」。已有训练记录不会删除。`
                          : `上架后，学生可进入「${item.title}」进行训练。请确认环境隔离、安全边界和访问权限。`,
                      danger: item.status === '已上架',
                      confirmLabel: item.status === '已上架' ? '确认下架' : '确认上架',
                      onConfirm: () => completeAction(item.status === '已上架' ? '靶场已下架' : '靶场已上架'),
                    })
                  }
                  primaryActionLabel={item.status === '已上架' ? '下架' : '上架'}
                  tags={item.tags}
                  title={item.title}
                  description={item.description}
                  difficulty={item.difficulty}
                  status={item.status}
                  id={item.id}
                />
              ))}

          {activeTab === '资源管理' && filteredResources.length === 0 && <EmptyLearningState label="没有匹配的资源" />}
          {activeTab === '靶场管理' && filteredRanges.length === 0 && <EmptyLearningState label="没有匹配的靶场" />}
        </div>
      </section>

      <EditLearningModal
        activeTab={activeTab}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onDone={() => completeAction(activeTab === '资源管理' ? '资源草稿已保存' : '靶场草稿已保存')}
      />
      <ConfirmDialog
        state={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          confirmAction?.onConfirm()
          setConfirmAction(null)
        }}
      />
    </>
  )
}

function LearningRow({
  description,
  difficulty,
  id,
  leftIcon,
  meta,
  onEdit,
  onToggleStatus,
  primaryActionLabel,
  status,
  tags,
  title,
}: {
  description: string
  difficulty: Difficulty
  id: string
  leftIcon: ReactNode
  meta: string[]
  onEdit: () => void
  onToggleStatus: () => void
  primaryActionLabel: string
  status: ItemStatus
  tags: string[]
  title: string
}) {
  return (
    <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-green-300">
            {leftIcon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{id}</span>
              <StatusBadge status={status} />
              <DifficultyBadge difficulty={difficulty} />
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span className="rounded-md bg-black/[0.04] px-2 py-1 text-xs text-slate-500 dark:bg-white/[0.06] dark:text-slate-400" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            type="button"
          >
            <Eye className="h-4 w-4" />
            预览
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={onEdit}
            type="button"
          >
            <Edit3 className="h-4 w-4" />
            编辑
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition ${
              primaryActionLabel === '下架' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
            onClick={onToggleStatus}
            type="button"
          >
            <Power className="h-4 w-4" />
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </SurfacePanel>
  )
}

function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClassMap[status]}`}>{status}</span>
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${difficultyClassMap[difficulty]}`}>{difficulty}</span>
}

function EmptyLearningState({ label }: { label: string }) {
  return (
    <SurfacePanel className="p-10 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-slate-400" />
      <h2 className="mt-4 text-xl font-semibold">{label}</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、类型、状态或难度后再试一次。</p>
    </SurfacePanel>
  )
}

function EditLearningModal({
  activeTab,
  item,
  onClose,
  onDone,
}: {
  activeTab: LearningTab
  item: ResourceItem | RangeItem | null
  onClose: () => void
  onDone: () => void
}) {
  if (!item) return null

  const isResource = activeTab === '资源管理'
  const itemType = isResource ? (item as ResourceItem).category : (item as RangeItem).type

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-[820px] overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
              {isResource ? <Layers3 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
              <span className="text-sm font-medium">{isResource ? 'Resource Editor' : 'Range Editor'}</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{item.id.includes('NEW') ? (isResource ? '新增资源' : '新增靶场') : isResource ? '编辑资源' : '编辑靶场'}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              保存为草稿后可在管理列表中继续编辑，上架操作需要二次确认。
            </p>
          </div>
          <button
            aria-label="关闭学习内容编辑"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{isResource ? '资源标题' : '靶场标题'}</span>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={item.title}
              placeholder={isResource ? '请输入资源标题' : '请输入靶场标题'}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput
              label={isResource ? '资源类型' : '靶场类型'}
              options={isResource ? ['工具下载', '学习资料'] : ['Web 靶场', '权限控制', '漏洞复测', '综合实战']}
              value={itemType}
            />
            <SelectInput label="难度等级" options={['入门', '进阶', '实战']} value={item.difficulty} />
            <SelectInput label="状态" options={['草稿', '已上架', '已下架']} value={item.status} />
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">内容说明</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={item.description}
              placeholder="说明内容用途、适用对象、使用边界和注意事项"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">负责人</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                defaultValue={item.owner}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">标签</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                defaultValue={item.tags.join('，')}
                placeholder="用顿号或逗号分隔"
              />
            </label>
          </div>

          <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-medium">{isResource ? '文件 / 下载地址' : '靶场入口 / 环境配置'}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isResource ? '后续接入文件上传、下载地址和权限控制。' : '后续接入在线环境地址、Docker 镜像、启动参数和访问权限。'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton icon={<Upload className="h-4 w-4" />} label={isResource ? '上传文件' : '上传配置'} />
              <ActionButton icon={<Link2 className="h-4 w-4" />} label="配置链接" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() => {
              onDone()
              onClose()
            }}
            type="button"
          >
            保存草稿
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}

function ConfirmDialog({
  onCancel,
  onConfirm,
  state,
}: {
  onCancel: () => void
  onConfirm: () => void
  state: ConfirmAction
}) {
  if (!state) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex gap-3">
          <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${state.danger ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{state.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{state.description}</p>
          </div>
          <button
            aria-label="关闭确认弹窗"
            className="h-9 rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            onClick={onConfirm}
            type="button"
          >
            {state.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
