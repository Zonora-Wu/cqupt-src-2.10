import {
  AlertTriangle,
  Edit3,
  ExternalLink,
  Filter,
  GraduationCap,
  Layers3,
  Plus,
  Power,
  RefreshCw,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  createLearningResource,
  deleteLearningResource,
  disableLearningResource,
  enableLearningResource,
  listManagedLearningResources,
  updateLearningResource,
} from '../../services/learning'
import type { LearningKind, LearningResourceItem, LearningResourcePayload } from '../../services/learning'

type ConfirmAction = {
  confirmLabel: string
  danger?: boolean
  description: string
  onConfirm: () => Promise<void>
  title: string
} | null

type FormState = LearningResourcePayload & {
  id?: string
}

const emptyForm: FormState = {
  active: true,
  category: '工具资源',
  description: '',
  externalUrl: '',
  kind: 'RESOURCE',
  title: '',
}

const kindOptions = ['全部类型', '工具资料', '靶场资源']
const statusOptions = ['全部状态', '已上架', '已下架']
const categoryPresets = ['工具资源', '文档资料', 'Web靶场', '权限控制靶场', '代码审计靶场', '报告规范']

export function AdminLearningManagement() {
  const [resources, setResources] = useState<LearningResourceItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [kind, setKind] = useState('全部类型')
  const [status, setStatus] = useState('全部状态')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadResources() {
    setError('')
    setLoading(true)
    try {
      const response = await listManagedLearningResources()
      setResources(response.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '学习资源加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadResources()
  }, [])

  const summary = useMemo(() => {
    const active = resources.filter((item) => item.active).length
    const resource = resources.filter((item) => item.kind === 'RESOURCE').length
    const range = resources.filter((item) => item.kind === 'RANGE').length
    return [
      { label: '全部内容', value: resources.length, hint: '未删除资源' },
      { label: '已上架', value: active, hint: '学生可访问' },
      { label: '工具资料', value: resource, hint: '文档与工具链接' },
      { label: '靶场资源', value: range, hint: '外部训练入口' },
    ]
  }, [resources])

  const filteredResources = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return resources.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.category.toLowerCase().includes(normalizedKeyword) ||
        item.externalUrl.toLowerCase().includes(normalizedKeyword)
      const matchesKind = kind === '全部类型' || item.kindLabel === kind
      const matchesStatus = status === '全部状态' || item.status === status

      return matchesKeyword && matchesKind && matchesStatus
    })
  }, [kind, keyword, resources, status])

  function flashMessage(nextMessage: string) {
    setError('')
    setMessage(nextMessage)
  }

  useEffect(() => {
    if (!message && !error) return undefined
    const timer = window.setTimeout(() => {
      setMessage('')
      setError('')
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [error, message])

  function openCreateModal(kindValue: LearningKind) {
    setEditing({
      ...emptyForm,
      category: kindValue === 'RANGE' ? 'Web靶场' : '工具资源',
      kind: kindValue,
    })
  }

  function openEditModal(item: LearningResourceItem) {
    setEditing({
      active: item.active,
      category: item.category,
      description: item.description,
      externalUrl: item.externalUrl,
      id: item.id,
      kind: item.kind,
      title: item.title,
    })
  }

  async function handleSave(payload: FormState) {
    setSaving(true)
    setError('')
    try {
      if (payload.id) {
        const updated = await updateLearningResource(payload.id, payload)
        setResources((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        flashMessage('学习资源已更新')
      } else {
        const created = await createLearningResource(payload)
        setResources((current) => [created, ...current])
        flashMessage('学习资源已创建')
      }
      setEditing(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function runResourceAction(action: () => Promise<LearningResourceItem>, successMessage: string) {
    setError('')
    try {
      const updated = await action()
      setResources((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      flashMessage(successMessage)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }

  async function runDeleteAction(id: string) {
    setError('')
    try {
      await deleteLearningResource(id)
      setResources((current) => current.filter((item) => item.id !== id))
      flashMessage('学习资源已删除')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败')
    }
  }

  return (
    <>
      <FloatingNotice
        message={message || error}
        variant={error ? 'error' : 'success'}
        onClose={() => {
          setMessage('')
          setError('')
        }}
      />
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <PageHeader
            eyebrow="Learning Ops"
            eyebrowIcon={<GraduationCap className="h-3.5 w-3.5" />}
            title="学习管理"
            description="统一维护学习资料、工具入口和靶场外部链接。学生登录后才可查看与访问，访问行为会计入资源使用次数。"
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => void loadResources()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-600/15 dark:text-green-300"
              onClick={() => openCreateModal('RANGE')}
              type="button"
            >
              <Target className="h-4 w-4" />
              新增靶场
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
              onClick={() => openCreateModal('RESOURCE')}
              type="button"
            >
              <Plus className="h-4 w-4" />
              新增资源
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {summary.map((item) => (
            <SurfacePanel className="p-4" key={item.label}>
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
            </SurfacePanel>
          ))}
        </div>

        <SurfacePanel className="relative z-30 mt-5 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px_170px_auto] xl:items-end">
            <SearchInput label="搜索内容" onChange={setKeyword} placeholder="标题、说明、分类或链接" value={keyword} />
            <SelectInput label="类型" onChange={setKind} options={kindOptions} value={kind} />
            <SelectInput label="状态" onChange={setStatus} options={statusOptions} value={status} />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => {
                setKeyword('')
                setKind('全部类型')
                setStatus('全部状态')
              }}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
        </SurfacePanel>

        <div className="mt-6 overflow-x-auto rounded-lg border border-black/10 bg-white/75 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <div className="grid grid-cols-[minmax(360px,1fr)_110px_120px_110px_140px_220px] gap-4 border-b border-black/10 px-5 py-3 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
            <span>内容</span>
            <span>类型</span>
            <span>分类</span>
            <span>状态</span>
            <span>使用次数</span>
            <span className="text-right">操作</span>
          </div>

          {loading && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载学习资源...</div>}

          {!loading &&
            filteredResources.map((item) => (
              <LearningResourceRow
                item={item}
                key={item.id}
                onDelete={() =>
                  setConfirmAction({
                    confirmLabel: '确认删除',
                    danger: true,
                    description: `删除后「${item.title}」将不再出现在管理列表中，学生端也无法访问。历史统计数据仍会保留在数据库记录中。`,
                    onConfirm: () => runDeleteAction(item.id),
                    title: '删除学习资源？',
                  })
                }
                onEdit={() => openEditModal(item)}
                onToggle={() =>
                  setConfirmAction({
                    confirmLabel: item.active ? '确认下架' : '确认上架',
                    danger: item.active,
                    description: item.active
                      ? `下架后，登录用户将不能再看到或访问「${item.title}」。`
                      : `上架后，登录用户可以看到并访问「${item.title}」，访问会统计次数。`,
                    onConfirm: () =>
                      runResourceAction(
                        () => (item.active ? disableLearningResource(item.id) : enableLearningResource(item.id)),
                        item.active ? '学习资源已下架' : '学习资源已上架',
                      ),
                    title: item.active ? '下架学习资源？' : '上架学习资源？',
                  })
                }
              />
            ))}
        </div>

        {!loading && filteredResources.length === 0 && (
          <EmptyState icon={<Layers3 className="h-10 w-10" />} title="没有匹配的学习资源" description="调整关键词、类型或状态后再试一次。" />
        )}
      </section>

      <LearningResourceModal
        initialValue={editing}
        onClose={() => setEditing(null)}
        onSave={(payload) => void handleSave(payload)}
        saving={saving}
      />
      <ConfirmDialog
        state={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction?.onConfirm
          setConfirmAction(null)
          if (action) void action()
        }}
      />
    </>
  )
}

function LearningResourceRow({
  item,
  onDelete,
  onEdit,
  onToggle,
}: {
  item: LearningResourceItem
  onDelete: () => void
  onEdit: () => void
  onToggle: () => void
}) {
  const Icon = item.kind === 'RANGE' ? Target : Layers3

  return (
    <div className="grid grid-cols-[minmax(360px,1fr)_110px_120px_110px_140px_220px] gap-4 border-b border-black/10 px-5 py-4 last:border-b-0 dark:border-white/10">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-green-300">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{item.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
            <a
              className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-700 hover:underline dark:text-green-300"
              href={item.externalUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.externalUrl}</span>
            </a>
          </div>
        </div>
      </div>
      <TableCell>{item.kindLabel}</TableCell>
      <TableCell>{item.category}</TableCell>
      <TableCell>
        <span
          className={`rounded-md border px-2 py-1 text-xs font-medium ${
            item.active
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400'
          }`}
        >
          {item.status}
        </span>
      </TableCell>
      <TableCell>{item.downloadCount} 次</TableCell>
      <div className="flex items-center justify-end gap-2">
        <IconButton label="编辑" onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
        </IconButton>
        <IconButton label={item.active ? '下架' : '上架'} onClick={onToggle}>
          <Power className="h-4 w-4" />
        </IconButton>
        <IconButton danger label="删除" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}

function LearningResourceModal({
  initialValue,
  onClose,
  onSave,
  saving,
}: {
  initialValue: FormState | null
  onClose: () => void
  onSave: (payload: FormState) => void
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    if (initialValue) {
      setForm(initialValue)
    }
  }, [initialValue])

  if (!initialValue) return null

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <form
        className="max-h-[88vh] w-full max-w-[760px] overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95"
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-700 dark:text-green-300">{form.id ? '编辑学习内容' : '新增学习内容'}</p>
            <h2 className="mt-2 text-2xl font-semibold">{form.kind === 'RANGE' ? '靶场资源' : '工具资料'}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">当前仅维护外部链接，资源内容由第三方页面或学校后续服务承载。</p>
          </div>
          <button
            aria-label="关闭学习资源弹窗"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput
              label="类型"
              onChange={(value) => updateField('kind', value === '靶场资源' ? 'RANGE' : 'RESOURCE')}
              options={['工具资料', '靶场资源']}
              value={form.kind === 'RANGE' ? '靶场资源' : '工具资料'}
            />
            <SelectInput
              label="分类"
              onChange={(value) => updateField('category', value)}
              options={categoryPresets}
              value={form.category}
            />
            <SelectInput
              label="状态"
              onChange={(value) => updateField('active', value === '已上架')}
              options={['已上架', '已下架']}
              value={form.active ? '已上架' : '已下架'}
            />
          </div>

          <Field label="标题" onChange={(value) => updateField('title', value)} placeholder="例如：OWASP WebGoat 靶场" value={form.title} />
          <Field
            label="外部链接"
            onChange={(value) => updateField('externalUrl', value)}
            placeholder="https://example.com/resource"
            value={form.externalUrl}
          />
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">说明</span>
            <textarea
              className="mt-2 min-h-32 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="说明资源用途、适合对象、使用边界和注意事项"
              value={form.description}
            />
          </label>
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
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  )
}

function IconButton({
  children,
  danger,
  label,
  onClick,
}: {
  children: ReactNode
  danger?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition ${
        danger
          ? 'border-red-500/20 text-red-600 hover:bg-red-500/10 dark:text-red-300'
          : 'border-black/10 text-slate-600 hover:bg-black/5 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

function TableCell({ children }: { children: ReactNode }) {
  return <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">{children}</div>
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
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
