import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  Filter,
  Gift,
  History,
  PackageCheck,
  Plus,
  Power,
  Printer,
  ShoppingBag,
  TicketCheck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

type MallTab = '商品管理' | '兑换处理'
type ProductStatus = '已上架' | '草稿' | '已下架' | '缺货'
type ExchangeStatus = '待审核' | '待领取' | '已完成' | '已驳回'
type ProductCategory = '实体奖励' | '学习权益' | '证书周边'

type MallProduct = {
  id: string
  name: string
  category: ProductCategory
  status: ProductStatus
  points: number
  stock: number
  exchanged: number
  owner: string
  updatedAt: string
  pickupLocation: string
  description: string
  tags: string[]
}

type ExchangeRecord = {
  id: string
  productName: string
  category: ProductCategory
  status: ExchangeStatus
  applicant: string
  unifiedCode: string
  points: number
  appliedAt: string
  processedBy: string
  pickupLocation: string
  note: string
}

type ConfirmAction = {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
} | null

const productStatusOptions = ['全部状态', '已上架', '草稿', '已下架', '缺货']
const exchangeStatusOptions = ['全部状态', '待审核', '待领取', '已完成', '已驳回']
const categoryOptions = ['全部类型', '实体奖励', '学习权益', '证书周边']

const products: MallProduct[] = [
  {
    id: 'MALL-2026-001',
    name: 'CQUPT-SRC 定制笔记本',
    category: '实体奖励',
    status: '已上架',
    points: 280,
    stock: 18,
    exchanged: 36,
    owner: '平台管理员',
    updatedAt: '2026-04-24',
    pickupLocation: '信息化办公室 302',
    description: '用于记录漏洞复现过程、学习笔记和靶场训练思路的定制笔记本。',
    tags: ['实物', '学习记录'],
  },
  {
    id: 'MALL-2026-002',
    name: '安全工具进阶资料包',
    category: '学习权益',
    status: '已上架',
    points: 360,
    stock: 42,
    exchanged: 21,
    owner: '审核员 A',
    updatedAt: '2026-04-22',
    pickupLocation: '线上发放',
    description: '包含常见 Web 测试工具配置说明、使用边界和报告模板。',
    tags: ['资料', '工具'],
  },
  {
    id: 'MALL-2026-003',
    name: '漏洞证书精装打印服务',
    category: '证书周边',
    status: '已上架',
    points: 520,
    stock: 12,
    exchanged: 8,
    owner: '平台管理员',
    updatedAt: '2026-04-20',
    pickupLocation: '网络安全学院办公室',
    description: '将已获得的高价值漏洞证书进行精装打印，适合个人成长档案留存。',
    tags: ['证书', '纪念'],
  },
  {
    id: 'MALL-2026-004',
    name: 'CQUPT-SRC 定制徽章',
    category: '实体奖励',
    status: '缺货',
    points: 180,
    stock: 0,
    exchanged: 52,
    owner: '平台管理员',
    updatedAt: '2026-04-18',
    pickupLocation: '信息化办公室 302',
    description: '面向有效漏洞贡献者的定制徽章，库存补充后可继续兑换。',
    tags: ['实物', '纪念'],
  },
]

const exchangeRecords: ExchangeRecord[] = [
  {
    id: 'EX-2026-0018',
    productName: 'CQUPT-SRC 定制笔记本',
    category: '实体奖励',
    status: '待审核',
    applicant: '星火同学',
    unifiedCode: '2025001',
    points: 280,
    appliedAt: '2026-04-28 09:12',
    processedBy: '未处理',
    pickupLocation: '信息化办公室 302',
    note: '申请线下领取，用户积分充足。',
  },
  {
    id: 'EX-2026-0017',
    productName: '漏洞证书精装打印服务',
    category: '证书周边',
    status: '待领取',
    applicant: '青木同学',
    unifiedCode: '2025001',
    points: 520,
    appliedAt: '2026-04-27 16:30',
    processedBy: '平台管理员',
    pickupLocation: '网络安全学院办公室',
    note: '已通过审核，等待线下领取确认。',
  },
  {
    id: 'EX-2026-0016',
    productName: '安全工具进阶资料包',
    category: '学习权益',
    status: '已完成',
    applicant: '南山同学',
    unifiedCode: '2025007',
    points: 360,
    appliedAt: '2026-04-26 11:08',
    processedBy: '审核员 A',
    pickupLocation: '线上发放',
    note: '资料包已通过站内通知发放。',
  },
]

const categoryStyles: Record<ProductCategory, string> = {
  实体奖励: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  学习权益: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  证书周边: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

const productStatusStyles: Record<ProductStatus, string> = {
  已上架: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  草稿: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  已下架: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  缺货: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

const exchangeStatusStyles: Record<ExchangeStatus, string> = {
  待审核: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  待领取: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  已完成: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  已驳回: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function AdminPointsMallManagement() {
  const [activeTab, setActiveTab] = useState<MallTab>('商品管理')
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部类型')
  const [status, setStatus] = useState('全部状态')
  const [editingProduct, setEditingProduct] = useState<MallProduct | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionDone, setActionDone] = useState('')

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return products.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword))
      const matchesCategory = category === '全部类型' || item.category === category
      const matchesStatus = status === '全部状态' || item.status === status

      return matchesKeyword && matchesCategory && matchesStatus
    })
  }, [category, keyword, status])

  const filteredExchangeRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return exchangeRecords.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.productName.toLowerCase().includes(normalizedKeyword) ||
        item.applicant.toLowerCase().includes(normalizedKeyword) ||
        item.unifiedCode.toLowerCase().includes(normalizedKeyword)
      const matchesCategory = category === '全部类型' || item.category === category
      const matchesStatus = status === '全部状态' || item.status === status

      return matchesKeyword && matchesCategory && matchesStatus
    })
  }, [category, keyword, status])

  const completeAction = (message: string) => {
    setActionDone(message)
    window.setTimeout(() => setActionDone(''), 2200)
  }

  const resetFilters = () => {
    setKeyword('')
    setCategory('全部类型')
    setStatus('全部状态')
  }

  return (
    <>
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Mall Ops"
            eyebrowIcon={<ShoppingBag className="h-3.5 w-3.5" />}
            title="积分商城"
            description="管理积分商城商品、库存和兑换申请。兑换默认校内线下领取，不提供邮寄，所有处理动作写入审计日志。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() =>
              setEditingProduct({
                id: 'MALL-2026-NEW',
                name: '',
                category: '实体奖励',
                status: '草稿',
                points: 100,
                stock: 0,
                exchanged: 0,
                owner: '平台管理员',
                updatedAt: '2026-04-28',
                pickupLocation: '待配置',
                description: '',
                tags: [],
              })
            }
            type="button"
          >
            <Plus className="h-4 w-4" />
            新增商品
          </button>
        </div>

        {actionDone && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {actionDone}
          </div>
        )}

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
                  resetFilters()
                }}
                type="button"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {tab === '商品管理' ? <Gift className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  {tab}
                </span>
                <span className={`mt-1 block text-xs ${activeTab === tab ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
                  {tab === '商品管理' ? '维护商品、积分价格和库存' : '审核兑换、确认线下领取'}
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
              placeholder={activeTab === '商品管理' ? '商品编号、名称、说明或标签' : '兑换编号、商品、申请人或统一认证码'}
              value={keyword}
            />
            <SelectInput label="商品类型" onChange={setCategory} options={categoryOptions} value={category} />
            <SelectInput
              label={activeTab === '商品管理' ? '商品状态' : '处理状态'}
              onChange={setStatus}
              options={activeTab === '商品管理' ? productStatusOptions : exchangeStatusOptions}
              value={status}
            />
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
          {activeTab === '商品管理'
            ? filteredProducts.map((item) => (
                <ProductRow
                  item={item}
                  key={item.id}
                  onEdit={() => setEditingProduct(item)}
                  onToggleStatus={() =>
                    setConfirmAction({
                      title: item.status === '已上架' ? '确认下架商品？' : '确认上架商品？',
                      description:
                        item.status === '已上架'
                          ? `下架后，学生将无法兑换「${item.name}」。已有兑换申请不会自动取消。`
                          : `上架后，学生可以在积分商城看到并兑换「${item.name}」。请确认库存、领取地点和兑换积分无误。`,
                      danger: item.status === '已上架',
                      confirmLabel: item.status === '已上架' ? '确认下架' : '确认上架',
                      onConfirm: () => completeAction(item.status === '已上架' ? '商品已下架' : '商品已上架'),
                    })
                  }
                />
              ))
            : filteredExchangeRecords.map((item) => (
                <ExchangeRow
                  item={item}
                  key={item.id}
                  onApprove={() =>
                    setConfirmAction({
                      title: '确认通过兑换申请？',
                      description: `通过后，${item.applicant} 将进入待领取状态。请确认用户积分、商品库存和领取地点无误。`,
                      onConfirm: () => completeAction('兑换申请已通过'),
                    })
                  }
                  onComplete={() =>
                    setConfirmAction({
                      title: '确认已线下领取？',
                      description: `确认后，该兑换记录将标记为已完成。请确保 ${item.applicant} 已在校内线下领取对应奖励。`,
                      onConfirm: () => completeAction('线下领取已确认'),
                    })
                  }
                  onReject={() =>
                    setConfirmAction({
                      title: '确认驳回兑换申请？',
                      description: '驳回后将返还或冻结对应积分，具体规则后续由后端积分流水处理。该操作会写入审计日志。',
                      danger: true,
                      confirmLabel: '确认驳回',
                      onConfirm: () => completeAction('兑换申请已驳回'),
                    })
                  }
                />
              ))}

          {activeTab === '商品管理' && filteredProducts.length === 0 && <EmptyMallState label="没有匹配的商品" />}
          {activeTab === '兑换处理' && filteredExchangeRecords.length === 0 && <EmptyMallState label="没有匹配的兑换记录" />}
        </div>
      </section>

      <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onDone={() => completeAction('商品草稿已保存')} />
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

function ProductRow({ item, onEdit, onToggleStatus }: { item: MallProduct; onEdit: () => void; onToggleStatus: () => void }) {
  return (
    <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_270px] xl:items-start">
        <div className="flex gap-3">
          <ProductVisual category={item.category} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
              <CategoryBadge category={item.category} />
              <ProductStatusBadge status={item.status} />
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{item.name}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>积分：{item.points}</span>
              <span>库存：{item.stock}</span>
              <span>已兑换：{item.exchanged}</span>
              <span>领取：{item.pickupLocation}</span>
              <span>更新：{item.updatedAt}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span className="rounded-md bg-black/[0.04] px-2 py-1 text-xs text-slate-500 dark:bg-white/[0.06] dark:text-slate-400" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <button className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" type="button">
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
              item.status === '已上架' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
            onClick={onToggleStatus}
            type="button"
          >
            <Power className="h-4 w-4" />
            {item.status === '已上架' ? '下架' : '上架'}
          </button>
        </div>
      </div>
    </SurfacePanel>
  )
}

function ExchangeRow({
  item,
  onApprove,
  onComplete,
  onReject,
}: {
  item: ExchangeRecord
  onApprove: () => void
  onComplete: () => void
  onReject: () => void
}) {
  return (
    <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
            <CategoryBadge category={item.category} />
            <ExchangeStatusBadge status={item.status} />
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">{item.productName}</h2>
          <div className="mt-3 grid gap-x-5 gap-y-1 text-sm text-slate-500 sm:grid-cols-2 xl:grid-cols-4 dark:text-slate-400">
            <p>申请人：{item.applicant}</p>
            <p>统一认证码：{item.unifiedCode}</p>
            <p>消耗积分：{item.points}</p>
            <p>申请时间：{item.appliedAt}</p>
            <p>领取地点：{item.pickupLocation}</p>
            <p>处理人：{item.processedBy}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.note}</p>
        </div>

        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={item.status === '待领取' ? onComplete : onApprove}
            type="button"
          >
            <TicketCheck className="h-4 w-4" />
            {item.status === '待领取' ? '确认领取' : '通过'}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
            onClick={onReject}
            type="button"
          >
            <X className="h-4 w-4" />
            驳回
          </button>
        </div>
      </div>
    </SurfacePanel>
  )
}

function ProductVisual({ category }: { category: ProductCategory }) {
  const Icon = category === '实体奖励' ? BookOpen : category === '学习权益' ? PackageCheck : Printer

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-gradient-to-br from-emerald-100 via-white to-slate-100 text-brand-700 dark:border-white/10 dark:from-emerald-950/50 dark:via-white/[0.06] dark:to-slate-900 dark:text-green-300">
      <Icon className="h-7 w-7" />
    </div>
  )
}

function CategoryBadge({ category }: { category: ProductCategory }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[category]}`}>{category}</span>
}

function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${productStatusStyles[status]}`}>{status}</span>
}

function ExchangeStatusBadge({ status }: { status: ExchangeStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${exchangeStatusStyles[status]}`}>{status}</span>
}

function EmptyMallState({ label }: { label: string }) {
  return (
    <SurfacePanel className="p-10 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-slate-400" />
      <h2 className="mt-4 text-xl font-semibold">{label}</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、类型或状态后再试一次。</p>
    </SurfacePanel>
  )
}

function EditProductModal({
  onClose,
  onDone,
  product,
}: {
  onClose: () => void
  onDone: () => void
  product: MallProduct | null
}) {
  if (!product) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-[820px] overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
              <Gift className="h-5 w-5" />
              <span className="text-sm font-medium">Product Editor</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{product.id.includes('NEW') ? '新增商品' : '编辑商品'}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              商品兑换默认校内线下领取，不提供邮寄。上架前请确认库存、积分价格和领取地点。
            </p>
          </div>
          <button
            aria-label="关闭商品编辑"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">商品名称</span>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={product.name}
              placeholder="请输入商品名称"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="商品类型" options={['实体奖励', '学习权益', '证书周边']} value={product.category} />
            <SelectInput label="商品状态" options={['草稿', '已上架', '已下架', '缺货']} value={product.status} />
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">兑换积分</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                defaultValue={product.points}
                type="number"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">库存数量</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                defaultValue={product.stock}
                type="number"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">领取地点 / 发放方式</span>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                defaultValue={product.pickupLocation}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">商品说明</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={product.description}
              placeholder="说明商品用途、兑换限制、领取方式和注意事项"
            />
          </label>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
            积分商品不具备现金价值。涉及实物奖励时，请配置校内线下领取地点，并保留领取确认记录。
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
