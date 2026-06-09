import {
  AlertTriangle,
  Edit3,
  ExternalLink,
  Filter,
  GraduationCap,
  Layers3,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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
  uploadLearningCover,
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
  coverUrl: '',
  description: '',
  externalUrl: '',
  kind: 'RESOURCE',
  title: '',
}

const kindOptions = ['全部类型', '工具资料', '靶场资源']
const statusOptions = ['全部状态', '已上架', '已下架']
const categoryPresets: Record<LearningKind, string[]> = {
  RESOURCE: ['工具资源', '文档资料', '报告规范', '学习资料', '环境配置'],
  RANGE: ['Web靶场', '权限控制靶场', '代码审计靶场', '内网渗透靶场', '综合演练靶场'],
}

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
      coverUrl: item.coverUrl,
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

        <div className="mt-6 space-y-3">
          {loading && <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载学习资源...</SurfacePanel>}

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
    <SurfacePanel className="overflow-hidden p-0 transition hover:border-brand-600/30">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">{item.kindLabel}</span>
            <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">{item.category}</span>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                item.active
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.status}
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-green-300">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
              <a
                className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-700 hover:underline dark:text-green-300"
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

        <div className="flex flex-col justify-between gap-4 border-t border-black/10 bg-[#f7f9f7] p-5 dark:border-white/10 dark:bg-[#0f1511] xl:border-l xl:border-t-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#131a15]">
              <p className="text-xs text-slate-500 dark:text-slate-400">使用次数</p>
              <p className="mt-1 text-xl font-semibold">{item.downloadCount}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#131a15]">
              <p className="text-xs text-slate-500 dark:text-slate-400">当前状态</p>
              <p className="mt-1 text-sm font-semibold">{item.status}</p>
            </div>
          </div>
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
      </div>
    </SurfacePanel>
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
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverNotice, setCoverNotice] = useState('')
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialValue) {
      const categoryOptions = categoryPresets[initialValue.kind]
      setForm({
        ...initialValue,
        category: categoryOptions.includes(initialValue.category) ? initialValue.category : categoryOptions[0],
      })
    }
  }, [initialValue])

  if (!initialValue) return null

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateKind(nextKind: LearningKind) {
    setForm((current) => {
      const nextCategoryOptions = categoryPresets[nextKind]
      return {
        ...current,
        category: nextCategoryOptions[0],
        kind: nextKind,
      }
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(form)
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setCoverNotice('请选择图片文件')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setCoverNotice('图片大小不能超过 2MB')
      return
    }

    setCoverUploading(true)
    setCoverNotice('')
    try {
      const result = await uploadLearningCover(file)
      updateField('coverUrl', result.coverUrl)
      setCoverNotice('封面已上传')
      window.setTimeout(() => setCoverNotice(''), 2000)
    } catch (uploadError) {
      setCoverNotice(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setCoverUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <form
        className="max-h-[88vh] w-full max-w-[760px] overflow-y-auto rounded-lg border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#131a15]"
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
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              封面图片 <span className="font-normal text-slate-400">（可选）</span>
            </span>
            {form.coverUrl ? (
              <div className="mt-2 flex items-center gap-4 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <img
                  alt="资源封面预览"
                  className="h-20 w-28 shrink-0 rounded-lg object-cover"
                  src={form.coverUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{form.coverUrl}</p>
                  <button
                    className="mt-2 rounded-lg border border-black/10 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => updateField('coverUrl', '')}
                    type="button"
                  >
                    移除封面
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="mt-2 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-black/10 px-6 py-8 text-slate-500 transition hover:border-brand-600/40 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:hover:border-brand-200/40 dark:hover:text-brand-200"
                  disabled={coverUploading}
                  onClick={() => coverInputRef.current?.click()}
                  type="button"
                >
                  {coverUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8" />
                  )}
                  <span className="text-sm">{coverUploading ? '上传中...' : '点击上传本地封面'}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">支持 JPG、PNG、WebP、GIF，最大 2MB</span>
                </button>
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleCoverUpload}
                  ref={coverInputRef}
                  type="file"
                />
              </>
            )}
            {coverNotice && (
              <p className={`mt-2 text-xs ${coverNotice === '封面已上传' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {coverNotice}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 border-t border-black/10 dark:border-white/10" />
              <span className="text-xs text-slate-400 dark:text-slate-500">或输入图片 URL</span>
              <div className="flex-1 border-t border-black/10 dark:border-white/10" />
            </div>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              onChange={(event) => updateField('coverUrl', event.target.value)}
              placeholder="https://example.com/cover.png"
              value={form.coverUrl}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput
              label="类型"
              onChange={(value) => updateKind(value === '靶场资源' ? 'RANGE' : 'RESOURCE')}
              options={['工具资料', '靶场资源']}
              value={form.kind === 'RANGE' ? '靶场资源' : '工具资料'}
            />
            <SelectInput
              label="分类"
              onChange={(value) => updateField('category', value)}
              options={categoryPresets[form.kind]}
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
              className="mt-2 min-h-32 w-full resize-none rounded-lg border border-black/10 bg-white/95 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
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
        className="mt-2 w-full rounded-lg border border-black/10 bg-white/95 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
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
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#131a15]">
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
