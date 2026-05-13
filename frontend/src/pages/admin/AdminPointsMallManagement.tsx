import {
  AlertTriangle,
  Edit3,
  Filter,
  Gift,
  History,
  Loader2,
  Plus,
  Power,
  ShoppingBag,
  TicketCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { ModalShell } from '../../components/ui/ModalShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  activateMallProduct,
  cancelRedemption,
  completeRedemption,
  createMallProduct,
  deactivateMallProduct,
  deleteMallProduct,
  listManagedMallProducts,
  listManagedRedemptions,
  updateMallProduct,
  uploadProductImage,
} from '../../services/mall'
import type { MallProductItem, MallProductPayload, MallRedemptionItem, ManagedMallRedemptionItem } from '../../services/mall'

type MallTab = '商品管理' | '兑换处理'
type ConfirmAction = {
  confirmLabel: string
  danger?: boolean
  description: string
  onConfirm: () => Promise<void>
  title: string
} | null

type FormState = MallProductPayload & {
  id?: string
}

const emptyForm: FormState = {
  category: '实体奖励',
  description: '',
  imageUrl: '',
  name: '',
  perUserLimit: 1,
  pickupInstructions: '兑换成功后请携带校园卡或有效身份证明前往蓝山工作室领取。',
  pickupLocation: '蓝山工作室',
  pointsCost: 100,
  sortOrder: 0,
  status: 'DRAFT',
  stock: 0,
}

const categoryOptions = ['全部类型', '实体奖励', '学习权益', '证书周边']
const productStatusOptions = ['全部状态', '草稿', '已上架', '已下架']
const redemptionStatusOptions = ['全部状态', '待领取', '已领取', '已取消', '已过期']

export function AdminPointsMallManagement() {
  const [activeTab, setActiveTab] = useState<MallTab>('商品管理')
  const [products, setProducts] = useState<MallProductItem[]>([])
  const [redemptions, setRedemptions] = useState<ManagedMallRedemptionItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部类型')
  const [status, setStatus] = useState('全部状态')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadMall() {
    setError('')
    setLoading(true)
    try {
      const [productsResponse, redemptionsResponse] = await Promise.all([
        listManagedMallProducts(),
        listManagedRedemptions(),
      ])
      setProducts(productsResponse.items)
      setRedemptions(redemptionsResponse.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '积分商城加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMall()
  }, [])

  const summary = useMemo(
    () => [
      { label: '全部商品', value: products.length, hint: '未删除商品' },
      { label: '已上架', value: products.filter((item) => item.status === 'ACTIVE').length, hint: '学生可兑换' },
      { label: '待领取', value: redemptions.filter((item) => item.status === 'PENDING_PICKUP').length, hint: '需要线下确认' },
      { label: '已领取', value: redemptions.filter((item) => item.status === 'COMPLETED').length, hint: '已完成兑换' },
    ],
    [products, redemptions],
  )

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return products.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.category.toLowerCase().includes(normalizedKeyword)
      const matchesCategory = category === '全部类型' || item.category === category
      const matchesStatus = status === '全部状态' || item.statusLabel === status
      return matchesKeyword && matchesCategory && matchesStatus
    })
  }, [category, keyword, products, status])

  const filteredRedemptions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return redemptions.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.pickupCode.toLowerCase().includes(normalizedKeyword) ||
        item.product.name.toLowerCase().includes(normalizedKeyword) ||
        item.user.name.toLowerCase().includes(normalizedKeyword) ||
        item.user.unifiedCode.toLowerCase().includes(normalizedKeyword)
      const matchesCategory = category === '全部类型' || item.product.category === category
      const matchesStatus = status === '全部状态' || item.statusLabel === status
      return matchesKeyword && matchesCategory && matchesStatus
    })
  }, [category, keyword, redemptions, status])

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

  function openEditModal(product: MallProductItem) {
    setEditing({
      category: product.category,
      description: product.description,
      id: product.id,
      imageUrl: product.imageUrl,
      name: product.name,
      perUserLimit: product.perUserLimit,
      pickupInstructions: product.pickupInstructions,
      pickupLocation: product.pickupLocation,
      pointsCost: product.pointsCost,
      sortOrder: product.sortOrder,
      status: product.status,
      stock: product.stock,
    })
  }

  async function handleSave(payload: FormState) {
    setSaving(true)
    setError('')
    try {
      if (payload.id) {
        const updated = await updateMallProduct(payload.id, payload)
        setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        flashMessage('商品已更新')
      } else {
        const created = await createMallProduct(payload)
        setProducts((current) => [created, ...current])
        flashMessage('商品已创建')
      }
      setEditing(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function runProductAction(action: () => Promise<MallProductItem>, successMessage: string) {
    setError('')
    try {
      const updated = await action()
      setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      flashMessage(successMessage)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }

  async function runDeleteProduct(id: string) {
    setError('')
    try {
      await deleteMallProduct(id)
      setProducts((current) => current.filter((item) => item.id !== id))
      flashMessage('商品已删除')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败')
    }
  }

  async function runRedemptionAction(action: () => Promise<MallRedemptionItem>, successMessage: string) {
    setError('')
    try {
      await action()
      await loadMall()
      flashMessage(successMessage)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '处理失败')
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
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Mall Ops"
            eyebrowIcon={<ShoppingBag className="h-3.5 w-3.5" />}
            title="积分商城"
            description="管理积分商品、库存和线下领取记录。所有兑换默认在蓝山工作室领取，不提供邮寄。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() => setEditing(emptyForm)}
            type="button"
          >
            <Plus className="h-4 w-4" />
            新增商品
          </button>
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

        <SurfacePanel className="mt-6 p-2">
          <div className="grid gap-2 md:grid-cols-2">
            {(['商品管理', '兑换处理'] as MallTab[]).map((tab) => (
              <button
                className={`rounded-lg px-4 py-3 text-left transition ${
                  activeTab === tab
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  setKeyword('')
                  setCategory('全部类型')
                  setStatus('全部状态')
                }}
                type="button"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {tab === '商品管理' ? <Gift className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  {tab}
                </span>
                <span className={`mt-1 block text-xs ${activeTab === tab ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
                  {tab === '商品管理' ? '维护商品、积分价格和库存' : '确认领取或取消兑换'}
                </span>
              </button>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="relative z-30 mt-5 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px_170px_auto] xl:items-end">
            <SearchInput
              label={activeTab === '商品管理' ? '搜索商品' : '搜索兑换记录'}
              onChange={setKeyword}
              placeholder={activeTab === '商品管理' ? '商品名称、说明或分类' : '领取码、商品、申请人或统一认证码'}
              value={keyword}
            />
            <SelectInput label="商品类型" onChange={setCategory} options={categoryOptions} value={category} />
            <SelectInput
              label={activeTab === '商品管理' ? '商品状态' : '领取状态'}
              onChange={setStatus}
              options={activeTab === '商品管理' ? productStatusOptions : redemptionStatusOptions}
              value={status}
            />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => {
                setKeyword('')
                setCategory('全部类型')
                setStatus('全部状态')
              }}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
        </SurfacePanel>

        <div className="mt-5 grid gap-3">
          {loading && <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载积分商城...</SurfacePanel>}

          {!loading &&
            activeTab === '商品管理' &&
            filteredProducts.map((item) => (
              <ProductRow
                item={item}
                key={item.id}
                onDelete={() =>
                  setConfirmAction({
                    confirmLabel: '确认删除',
                    danger: true,
                    description: `删除后「${item.name}」将不再显示。若存在待领取记录，后端会拒绝删除。`,
                    onConfirm: () => runDeleteProduct(item.id),
                    title: '删除商品？',
                  })
                }
                onEdit={() => openEditModal(item)}
                onToggle={() =>
                  setConfirmAction({
                    confirmLabel: item.status === 'ACTIVE' ? '确认下架' : '确认上架',
                    danger: item.status === 'ACTIVE',
                    description:
                      item.status === 'ACTIVE'
                        ? `下架后，学生将无法兑换「${item.name}」。已有待领取记录不受影响。`
                        : `上架后，学生可以兑换「${item.name}」。请确认库存、积分价格和领取地点。`,
                    onConfirm: () =>
                      runProductAction(
                        () => (item.status === 'ACTIVE' ? deactivateMallProduct(item.id) : activateMallProduct(item.id)),
                        item.status === 'ACTIVE' ? '商品已下架' : '商品已上架',
                      ),
                    title: item.status === 'ACTIVE' ? '下架商品？' : '上架商品？',
                  })
                }
              />
            ))}

          {!loading &&
            activeTab === '兑换处理' &&
            filteredRedemptions.map((item) => (
              <RedemptionRow
                item={item}
                key={item.id}
                onCancel={() =>
                  setConfirmAction({
                    confirmLabel: '确认取消',
                    danger: true,
                    description: `取消后会返还 ${item.pointsCost} 积分，并恢复商品库存。`,
                    onConfirm: () => runRedemptionAction(() => cancelRedemption(item.id, '管理员取消兑换并返还积分。'), '兑换已取消，积分已返还'),
                    title: '取消兑换？',
                  })
                }
                onComplete={() =>
                  setConfirmAction({
                    confirmLabel: '确认已领取',
                    description: `确认用户已凭领取码 ${item.pickupCode} 在蓝山工作室领取「${item.product.name}」。`,
                    onConfirm: () => runRedemptionAction(() => completeRedemption(item.id, '已在蓝山工作室线下领取。'), '兑换已确认领取'),
                    title: '确认线下领取？',
                  })
                }
              />
            ))}
        </div>

        {!loading && activeTab === '商品管理' && filteredProducts.length === 0 && (
          <EmptyState icon={<Gift className="h-10 w-10" />} title="没有匹配的商品" description="调整关键词、类型或状态后再试一次。" />
        )}
        {!loading && activeTab === '兑换处理' && filteredRedemptions.length === 0 && (
          <EmptyState icon={<History className="h-10 w-10" />} title="没有匹配的兑换记录" description="调整关键词、类型或状态后再试一次。" />
        )}
      </section>

      <ProductModal initialValue={editing} onClose={() => setEditing(null)} onSave={(payload) => void handleSave(payload)} saving={saving} />
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

function ProductRow({
  item,
  onDelete,
  onEdit,
  onToggle,
}: {
  item: MallProductItem
  onDelete: () => void
  onEdit: () => void
  onToggle: () => void
}) {
  return (
    <SurfacePanel className="p-4 transition hover:border-brand-600/30 dark:hover:border-brand-600/30">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_230px] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id.slice(0, 14)}</span>
            <Badge>{item.category}</Badge>
            <Badge tone={item.status === 'ACTIVE' ? 'green' : 'gray'}>{item.statusLabel}</Badge>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">{item.name}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>积分：{item.pointsCost}</span>
            <span>库存：{item.stock}</span>
            <span>限兑：{item.perUserLimit === 0 ? '无限制' : item.perUserLimit}</span>
            <span>领取：{item.pickupLocation}</span>
            <span>排序：{item.sortOrder}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <IconButton label="编辑" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </IconButton>
          <IconButton label={item.status === 'ACTIVE' ? '下架' : '上架'} onClick={onToggle}>
            <Power className="h-4 w-4" />
          </IconButton>
          <IconButton danger label="删除" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </SurfacePanel>
  )
}

function RedemptionRow({
  item,
  onCancel,
  onComplete,
}: {
  item: ManagedMallRedemptionItem
  onCancel: () => void
  onComplete: () => void
}) {
  const pending = item.status === 'PENDING_PICKUP'

  return (
    <SurfacePanel className="p-4 transition hover:border-brand-600/30 dark:hover:border-brand-600/30">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_230px] xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.pickupCode}</span>
            <Badge>{item.product.category}</Badge>
            <Badge tone={pending ? 'yellow' : item.status === 'COMPLETED' ? 'green' : 'gray'}>{item.statusLabel}</Badge>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">{item.product.name}</h2>
          <div className="mt-3 grid gap-x-5 gap-y-1 text-sm text-slate-500 sm:grid-cols-2 xl:grid-cols-4 dark:text-slate-400">
            <p>申请人：{item.user.name}</p>
            <p>统一认证码：{item.user.unifiedCode}</p>
            <p>消耗积分：{item.pointsCost}</p>
            <p>申请时间：{formatDate(item.requestedAt)}</p>
            <p>领取地点：{item.product.pickupLocation}</p>
            <p>邮箱：{item.user.email}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.note}</p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!pending}
            onClick={onComplete}
            type="button"
          >
            <TicketCheck className="h-4 w-4" />
            确认领取
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
            disabled={!pending}
            onClick={onCancel}
            type="button"
          >
            <X className="h-4 w-4" />
            取消
          </button>
        </div>
      </div>
    </SurfacePanel>
  )
}

function ProductModal({
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
  const [imageUploading, setImageUploading] = useState(false)
  const [imageNotice, setImageNotice] = useState('')
  const [showCustomLimit, setShowCustomLimit] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialValue) setForm(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (initialValue) {
      document.documentElement.classList.add('auth-modal-open')
      return () => document.documentElement.classList.remove('auth-modal-open')
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

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageNotice('请选择图片文件')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageNotice('图片大小不能超过 2MB')
      return
    }
    setImageUploading(true)
    setImageNotice('')
    try {
      const result = await uploadProductImage(file)
      updateField('imageUrl', result.imageUrl)
      setImageNotice('图片已上传')
      setTimeout(() => setImageNotice(''), 2000)
    } catch (err) {
      setImageNotice(err instanceof Error ? err.message : '上传失败')
    } finally {
      setImageUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] isolate flex items-center justify-center p-4">
      <button
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative max-h-[90vh] w-full max-w-[660px] transform-gpu overflow-y-auto rounded-lg border border-black/10 bg-white p-8 text-slate-950 shadow-2xl [scrollbar-width:none] dark:border-white/10 dark:bg-[#131a15] dark:text-white [&::-webkit-scrollbar]:hidden"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <button
          aria-label="关闭弹窗"
          className="absolute right-4 top-4 rounded-md p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="mb-6 text-center text-lg font-semibold">
          {form.id ? '编辑商品' : '新增商品'}
        </h3>

        <form className="space-y-5" onSubmit={submit}>
          {/* ── 图片上传区 ── */}
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              商品图片 <span className="font-normal text-slate-400">（可选）</span>
            </span>
            {form.imageUrl ? (
              <div className="relative inline-block">
                <img
                  alt="商品图片预览"
                  className="h-32 w-32 rounded-lg border border-black/10 object-cover dark:border-white/10"
                  src={form.imageUrl}
                />
                <button
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition hover:bg-red-600"
                  onClick={() => updateField('imageUrl', '')}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-black/10 px-6 py-8 text-slate-500 transition hover:border-brand-600/40 hover:text-brand-700 dark:border-white/10 dark:hover:border-brand-200/40 dark:hover:text-brand-200"
                  disabled={imageUploading}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {imageUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8" />
                  )}
                  <span className="text-sm">
                    {imageUploading ? '上传中...' : '点击上传图片'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    支持 JPG、PNG、WebP、GIF，最大 2MB
                  </span>
                </button>
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                  type="file"
                />
                {imageNotice && (
                  <p className={`mt-2 text-xs ${imageNotice === '图片已上传' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {imageNotice}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 border-t border-black/10 dark:border-white/10" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">或输入图片 URL</span>
                  <div className="flex-1 border-t border-black/10 dark:border-white/10" />
                </div>
                <input
                  className="mt-2 w-full rounded-lg border border-black/10 bg-white/95 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                  onChange={(e) => updateField('imageUrl', e.target.value)}
                  placeholder="https://example.com/image.png"
                  value={form.imageUrl === '' ? '' : form.imageUrl}
                />
              </>
            )}
          </div>

          {/* ── 基本信息 ── */}
          <div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">商品名称</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/95 px-3 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="请输入商品名称"
                value={form.name}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="商品类型" onChange={(value) => updateField('category', value)} options={['实体奖励', '学习权益', '证书周边']} value={form.category} />
            <SelectInput
              label="商品状态"
              onChange={(value) => updateField('status', value === '已上架' ? 'ACTIVE' : value === '已下架' ? 'INACTIVE' : 'DRAFT')}
              options={['草稿', '已上架', '已下架']}
              value={form.status === 'ACTIVE' ? '已上架' : form.status === 'INACTIVE' ? '已下架' : '草稿'}
            />
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">兑换积分</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                min={0}
                onChange={(e) => updateField('pointsCost', Number(e.target.value))}
                type="number"
                value={form.pointsCost}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">库存数量</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                min={0}
                onChange={(e) => updateField('stock', Number(e.target.value))}
                type="number"
                value={form.stock}
              />
            </label>
            <SelectInput
              label="每人限兑"
              onChange={(value) => {
                if (value === '无限制') {
                  updateField('perUserLimit', 0)
                } else {
                  setShowCustomLimit(true)
                }
              }}
              options={['无限制', '自定义']}
              value={form.perUserLimit === 0 ? '无限制' : `自定义 (${form.perUserLimit}次)`}
            />
            {showCustomLimit && (
              <div className="fixed inset-0 z-[150] isolate flex items-center justify-center p-4">
                <button
                  aria-label="关闭"
                  className="absolute inset-0 bg-black/35 backdrop-blur-sm"
                  onClick={() => {
                    if (form.perUserLimit <= 0) updateField('perUserLimit', 1)
                    setShowCustomLimit(false)
                  }}
                  type="button"
                />
                <motion.section
                  animate={{ opacity: 1, y: 0 }}
                  className="relative w-full max-w-[320px] rounded-lg border border-black/10 bg-white p-6 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-[#131a15] dark:text-white"
                  initial={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <button
                    aria-label="关闭"
                    className="absolute right-3 top-3 rounded-md p-1.5 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() => {
                      if (form.perUserLimit <= 0) updateField('perUserLimit', 1)
                      setShowCustomLimit(false)
                    }}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <h4 className="mb-4 text-center text-sm font-semibold">自定义每人限兑数量</h4>
                  <input
                    autoFocus
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                    min={1}
                    onChange={(e) => updateField('perUserLimit', Math.max(1, Number(e.target.value)))}
                    onKeyDown={(e) => e.key === 'Enter' && setShowCustomLimit(false)}
                    type="number"
                    value={form.perUserLimit}
                  />
                  <button
                    className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                    onClick={() => setShowCustomLimit(false)}
                    type="button"
                  >
                    确定
                  </button>
                </motion.section>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">排序权重</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                onChange={(e) => updateField('sortOrder', Number(e.target.value))}
                type="number"
                value={form.sortOrder}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">领取地点</span>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-white/95 px-3 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
              onChange={(e) => updateField('pickupLocation', e.target.value)}
              value={form.pickupLocation}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">商品说明 <span className="font-normal text-slate-400">（可选）</span></span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
              onChange={(e) => updateField('description', e.target.value)}
              value={form.description}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">领取说明</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
              onChange={(e) => updateField('pickupInstructions', e.target.value)}
              value={form.pickupInstructions}
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
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
      </motion.section>
    </div>
  )
}

function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'yellow' }) {
  const classes = {
    gray: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    yellow: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  }
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${classes[tone]}`}>{children}</span>
}

function IconButton({ children, danger, label, onClick }: { children: ReactNode; danger?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
        danger
          ? 'border-red-500/20 text-red-600 hover:bg-red-500/10 dark:text-red-300'
          : 'border-black/10 text-slate-600 hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

function ConfirmDialog({ onCancel, onConfirm, state }: { onCancel: () => void; onConfirm: () => void; state: ConfirmAction }) {
  if (!state) return null

  return (
    <ModalShell onClose={onCancel}>
      <div className="flex gap-3">
          <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${state.danger ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{state.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{state.description}</p>
          </div>
          <button className="h-9 rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onCancel} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={onCancel} type="button">
            取消
          </button>
          <button className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`} onClick={onConfirm} type="button">
            {state.confirmLabel}
          </button>
        </div>
    </ModalShell>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}
