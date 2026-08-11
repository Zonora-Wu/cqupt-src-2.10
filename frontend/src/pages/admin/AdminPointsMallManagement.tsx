import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Edit3,
  Filter,
  Gift,
  History,
  Loader2,
  Plus,
  Power,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { PaginationBar } from '../../components/ui/PaginationBar'
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
const defaultPageSize = 10
type SortDirection = 'asc' | 'desc'
type ProductSortKey = 'category' | 'name' | 'pickupLocation' | 'pointsCost' | 'status' | 'stock' | 'perUserLimit'
type RedemptionSortKey = 'pointsCost' | 'productName' | 'requestedAt' | 'status' | 'userName' | 'pickupLocation'

const defaultProductSort: { direction: SortDirection; key: ProductSortKey } = { direction: 'asc', key: 'name' }
const defaultRedemptionSort: { direction: SortDirection; key: RedemptionSortKey } = { direction: 'desc', key: 'requestedAt' }

export function AdminPointsMallManagement() {
  const [activeTab, setActiveTab] = useState<MallTab>('商品管理')
  const [products, setProducts] = useState<MallProductItem[]>([])
  const [redemptions, setRedemptions] = useState<ManagedMallRedemptionItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部类型')
  const [status, setStatus] = useState('全部状态')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [productSortKey, setProductSortKey] = useState<ProductSortKey | null>(null)
  const [productSortDirection, setProductSortDirection] = useState<SortDirection>(defaultProductSort.direction)
  const [redemptionSortKey, setRedemptionSortKey] = useState<RedemptionSortKey | null>(null)
  const [redemptionSortDirection, setRedemptionSortDirection] = useState<SortDirection>(defaultRedemptionSort.direction)
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
    let active = true
    queueMicrotask(() => {
      if (active) void loadMall()
    })
    return () => {
      active = false
    }
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

  const sortedProducts = useMemo(
    () => [...filteredProducts].sort((a, b) => compareProducts(a, b, productSortKey ?? defaultProductSort.key, productSortKey ? productSortDirection : defaultProductSort.direction)),
    [filteredProducts, productSortDirection, productSortKey],
  )
  const sortedRedemptions = useMemo(
    () => [...filteredRedemptions].sort((a, b) => compareRedemptions(a, b, redemptionSortKey ?? defaultRedemptionSort.key, redemptionSortKey ? redemptionSortDirection : defaultRedemptionSort.direction)),
    [filteredRedemptions, redemptionSortDirection, redemptionSortKey],
  )

  const activeItemsTotal = activeTab === '商品管理' ? filteredProducts.length : filteredRedemptions.length
  const totalPages = Math.max(1, Math.ceil(activeItemsTotal / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedProducts.slice(start, start + pageSize)
  }, [pageSize, safePage, sortedProducts])
  const paginatedRedemptions = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedRedemptions.slice(start, start + pageSize)
  }, [pageSize, safePage, sortedRedemptions])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) setPage(1)
    })
    return () => {
      active = false
    }
  }, [activeTab, category, keyword, pageSize, status])

  function flashMessage(nextMessage: string) {
    setError('')
    setMessage(nextMessage)
  }

  function resetLedgerFilters() {
    setKeyword('')
    setCategory('全部类型')
    setStatus('全部状态')
    setPage(1)
  }

  function changeProductSort(nextKey: ProductSortKey) {
    if (productSortKey !== nextKey) {
      setProductSortKey(nextKey)
      setProductSortDirection('asc')
    } else if (productSortDirection === 'asc') {
      setProductSortDirection('desc')
    } else {
      setProductSortKey(null)
      setProductSortDirection(defaultProductSort.direction)
    }
    setPage(1)
  }

  function changeRedemptionSort(nextKey: RedemptionSortKey) {
    if (redemptionSortKey !== nextKey) {
      setRedemptionSortKey(nextKey)
      setRedemptionSortDirection('asc')
    } else if (redemptionSortDirection === 'asc') {
      setRedemptionSortDirection('desc')
    } else {
      setRedemptionSortKey(null)
      setRedemptionSortDirection(defaultRedemptionSort.direction)
    }
    setPage(1)
  }

  const currentFilterLabels = [
    keyword.trim() ? `关键词：${keyword.trim()}` : '',
    category !== '全部类型' ? `类型：${category}` : '',
    status !== '全部状态' ? `${activeTab === '商品管理' ? '商品状态' : '领取状态'}：${status}` : '',
  ].filter(Boolean)

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
                  setPage(1)
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
              onClick={resetLedgerFilters}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-4 text-xs dark:border-white/10">
            <span className="rounded-md border border-brand-600/20 bg-brand-600/10 px-2.5 py-1 font-medium text-brand-800 dark:text-brand-200">
              当前结果 {activeItemsTotal}
            </span>
            {currentFilterLabels.length > 0 ? (
              currentFilterLabels.map((item) => (
                <span className="rounded-md border border-black/10 bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-slate-600 dark:border-white/10 dark:text-slate-300" key={item}>
                  {item}
                </span>
              ))
            ) : (
              <span className="text-slate-500 dark:text-slate-400">当前展示全部{activeTab === '商品管理' ? '商品' : '兑换记录'}</span>
            )}
          </div>
        </SurfacePanel>

        <SurfacePanel className="mt-5 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 dark:border-white/10">
            <div>
              <h2 className="text-sm font-semibold">{activeTab === '商品管理' ? '商品台账' : '兑换台账'}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">共 {activeItemsTotal} 条，按当前筛选条件展示</p>
            </div>
            <span className="rounded-md bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400">数据视图</span>
          </div>

          {activeTab === '商品管理' ? (
            <div className="grid grid-cols-[minmax(260px,1fr)_96px] gap-4 border-b border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-white/10 dark:text-slate-500 xl:grid-cols-[minmax(320px,1fr)_96px_88px_82px_82px_100px_108px] 2xl:grid-cols-[minmax(420px,1fr)_110px_90px_82px_82px_100px_100px_120px]">
              <SortHeaderButton active={(productSortKey ?? defaultProductSort.key) === 'name'} direction={productSortKey ? productSortDirection : defaultProductSort.direction} label="商品 / 编号" onClick={() => changeProductSort('name')} />
              <SortHeaderButton active={(productSortKey ?? defaultProductSort.key) === 'category'} className="hidden xl:inline-flex" direction={productSortKey ? productSortDirection : defaultProductSort.direction} label="类型" onClick={() => changeProductSort('category')} />
              <SortHeaderButton active={(productSortKey ?? defaultProductSort.key) === 'status'} className="hidden xl:inline-flex" direction={productSortKey ? productSortDirection : defaultProductSort.direction} label="状态" onClick={() => changeProductSort('status')} />
              <SortHeaderButton active={(productSortKey ?? defaultProductSort.key) === 'pointsCost'} className="hidden xl:inline-flex" direction={productSortKey ? productSortDirection : defaultProductSort.direction} label="积分" onClick={() => changeProductSort('pointsCost')} />
              <SortHeaderButton active={(productSortKey ?? defaultProductSort.key) === 'stock'} className="hidden xl:inline-flex" direction={productSortKey ? productSortDirection : defaultProductSort.direction} label="库存" onClick={() => changeProductSort('stock')} />
              <SortHeaderButton active={(productSortKey ?? defaultProductSort.key) === 'perUserLimit'} className="hidden xl:inline-flex" direction={productSortKey ? productSortDirection : defaultProductSort.direction} label="限兑" onClick={() => changeProductSort('perUserLimit')} />
              <SortHeaderButton active={(productSortKey ?? defaultProductSort.key) === 'pickupLocation'} className="hidden 2xl:inline-flex" direction={productSortKey ? productSortDirection : defaultProductSort.direction} label="领取地点" onClick={() => changeProductSort('pickupLocation')} />
              <span className="text-right">操作</span>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(260px,1fr)_96px] gap-4 border-b border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-white/10 dark:text-slate-500 xl:grid-cols-[minmax(320px,1fr)_96px_120px_86px_132px_108px_132px] 2xl:grid-cols-[minmax(420px,1fr)_104px_130px_90px_136px_120px_150px]">
              <SortHeaderButton active={(redemptionSortKey ?? defaultRedemptionSort.key) === 'productName'} direction={redemptionSortKey ? redemptionSortDirection : defaultRedemptionSort.direction} label="商品 / 领取码" onClick={() => changeRedemptionSort('productName')} />
              <SortHeaderButton active={(redemptionSortKey ?? defaultRedemptionSort.key) === 'status'} className="hidden xl:inline-flex" direction={redemptionSortKey ? redemptionSortDirection : defaultRedemptionSort.direction} label="状态" onClick={() => changeRedemptionSort('status')} />
              <SortHeaderButton active={(redemptionSortKey ?? defaultRedemptionSort.key) === 'userName'} className="hidden xl:inline-flex" direction={redemptionSortKey ? redemptionSortDirection : defaultRedemptionSort.direction} label="申请人" onClick={() => changeRedemptionSort('userName')} />
              <SortHeaderButton active={(redemptionSortKey ?? defaultRedemptionSort.key) === 'pointsCost'} className="hidden xl:inline-flex" direction={redemptionSortKey ? redemptionSortDirection : defaultRedemptionSort.direction} label="积分" onClick={() => changeRedemptionSort('pointsCost')} />
              <SortHeaderButton active={(redemptionSortKey ?? defaultRedemptionSort.key) === 'requestedAt'} className="hidden xl:inline-flex" direction={redemptionSortKey ? redemptionSortDirection : defaultRedemptionSort.direction} label="申请时间" onClick={() => changeRedemptionSort('requestedAt')} />
              <SortHeaderButton active={(redemptionSortKey ?? defaultRedemptionSort.key) === 'pickupLocation'} className="hidden xl:inline-flex" direction={redemptionSortKey ? redemptionSortDirection : defaultRedemptionSort.direction} label="领取地点" onClick={() => changeRedemptionSort('pickupLocation')} />
              <span className="text-right">操作</span>
            </div>
          )}

          {loading && <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载积分商城...</SurfacePanel>}

          {!loading &&
            activeTab === '商品管理' &&
            paginatedProducts.map((item) => (
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
            paginatedRedemptions.map((item) => (
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

          {!loading && activeItemsTotal === 0 && (
            <div className="p-10 text-center">
              {activeTab === '商品管理' ? <Gift className="mx-auto h-10 w-10 text-slate-400" /> : <History className="mx-auto h-10 w-10 text-slate-400" />}
              <h2 className="mt-4 text-xl font-semibold">{activeTab === '商品管理' ? '没有匹配的商品' : '没有匹配的兑换记录'}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、类型或状态后再试一次。</p>
            </div>
          )}

          <PaginationBar
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            page={safePage}
            pageSize={pageSize}
            total={activeItemsTotal}
          />
        </SurfacePanel>
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
    <div className="grid grid-cols-[minmax(260px,1fr)_96px] gap-4 border-b border-black/10 px-3 py-3 transition last:border-b-0 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.045] xl:grid-cols-[minmax(320px,1fr)_96px_88px_82px_82px_100px_108px] 2xl:grid-cols-[minmax(420px,1fr)_110px_90px_82px_82px_100px_100px_120px]">
      <div className="flex min-w-0 items-center gap-3">
        {item.imageUrl ? (
          <img alt={`${item.name} 图片`} className="h-11 w-11 shrink-0 rounded-lg object-cover" src={item.imageUrl} />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-xs font-semibold text-brand-700 dark:text-brand-300">商品</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.name}</p>
          <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{item.id.slice(0, 14)}</p>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400 xl:hidden">{item.description}</p>
        </div>
      </div>
      <div className="hidden min-w-0 xl:block"><Badge>{item.category}</Badge></div>
      <div className="hidden min-w-0 xl:block"><Badge tone={item.status === 'ACTIVE' ? 'green' : 'gray'}>{item.statusLabel}</Badge></div>
      <div className="hidden min-w-0 xl:block"><LedgerText value={`${item.pointsCost}`} /></div>
      <div className="hidden min-w-0 xl:block"><LedgerText value={`${item.stock}`} /></div>
      <div className="hidden min-w-0 xl:block"><LedgerText value={item.perUserLimit === 0 ? '无限制' : `${item.perUserLimit}`} /></div>
      <div className="hidden min-w-0 2xl:block"><LedgerText value={item.pickupLocation} /></div>
      <div className="flex items-center justify-end gap-2">
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
    <div className="grid grid-cols-[minmax(260px,1fr)_96px] gap-4 border-b border-black/10 px-3 py-3 transition last:border-b-0 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.045] xl:grid-cols-[minmax(320px,1fr)_96px_120px_86px_132px_108px_132px] 2xl:grid-cols-[minmax(420px,1fr)_104px_130px_90px_136px_120px_150px]">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.product.name}</p>
          <Badge>{item.product.category}</Badge>
        </div>
        <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{item.pickupCode}</p>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400 xl:hidden">{item.user.name} / {item.user.unifiedCode}</p>
      </div>
      <div className="hidden min-w-0 xl:block"><Badge tone={pending ? 'yellow' : item.status === 'COMPLETED' ? 'green' : 'gray'}>{item.statusLabel}</Badge></div>
      <div className="hidden min-w-0 xl:block">
        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{item.user.name}</p>
        <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{item.user.unifiedCode}</p>
      </div>
      <div className="hidden min-w-0 xl:block"><LedgerText value={`${item.pointsCost}`} /></div>
      <div className="hidden min-w-0 xl:block"><LedgerText value={formatDate(item.requestedAt)} /></div>
      <div className="hidden min-w-0 xl:block"><LedgerText value={item.product.pickupLocation} /></div>
      <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!pending}
            onClick={onComplete}
            type="button"
          >
            领取
          </button>
          <button
            className="rounded-md border border-red-500/20 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
            disabled={!pending}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
      </div>
    </div>
  )
}

function SortHeaderButton({
  active,
  className = '',
  direction,
  label,
  onClick,
}: {
  active: boolean
  className?: string
  direction: SortDirection
  label: string
  onClick: () => void
}) {
  const Icon = active ? direction === 'asc' ? ChevronUp : ChevronDown : ArrowUpDown
  return (
    <button
      className={`group -ml-1 inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 ${className}`}
      onClick={onClick}
      title={`按${label}排序`}
      type="button"
    >
      <span className="truncate">{label}</span>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-brand-700 dark:text-brand-300' : 'opacity-45 group-hover:opacity-80'}`} />
    </button>
  )
}

function compareProducts(a: MallProductItem, b: MallProductItem, key: ProductSortKey, direction: SortDirection) {
  const modifier = direction === 'asc' ? 1 : -1
  const result = compareProductValue(a, b, key)
  if (result !== 0) return result * modifier
  return compareTimeValue(b.updatedAt, a.updatedAt) || compareTextValue(a.id, b.id)
}

function compareProductValue(a: MallProductItem, b: MallProductItem, key: ProductSortKey) {
  switch (key) {
    case 'category':
      return compareTextValue(a.category, b.category)
    case 'name':
      return compareTextValue(a.name, b.name)
    case 'pickupLocation':
      return compareTextValue(a.pickupLocation, b.pickupLocation)
    case 'pointsCost':
      return a.pointsCost - b.pointsCost
    case 'status':
      return compareTextValue(a.statusLabel, b.statusLabel)
    case 'stock':
      return a.stock - b.stock
    case 'perUserLimit':
      return a.perUserLimit - b.perUserLimit
  }
}

function compareRedemptions(a: ManagedMallRedemptionItem, b: ManagedMallRedemptionItem, key: RedemptionSortKey, direction: SortDirection) {
  const modifier = direction === 'asc' ? 1 : -1
  const result = compareRedemptionValue(a, b, key)
  if (result !== 0) return result * modifier
  return compareTimeValue(b.requestedAt, a.requestedAt) || compareTextValue(a.id, b.id)
}

function compareRedemptionValue(a: ManagedMallRedemptionItem, b: ManagedMallRedemptionItem, key: RedemptionSortKey) {
  switch (key) {
    case 'pickupLocation':
      return compareTextValue(a.product.pickupLocation, b.product.pickupLocation)
    case 'pointsCost':
      return a.pointsCost - b.pointsCost
    case 'productName':
      return compareTextValue(a.product.name, b.product.name)
    case 'requestedAt':
      return compareTimeValue(a.requestedAt, b.requestedAt)
    case 'status':
      return compareTextValue(a.statusLabel, b.statusLabel)
    case 'userName':
      return compareTextValue(a.user.name, b.user.name) || compareTextValue(a.user.unifiedCode, b.user.unifiedCode)
  }
}

function compareTextValue(a: string, b: string) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
}

function compareTimeValue(a: string | null | undefined, b: string | null | undefined) {
  const left = a ? new Date(a).getTime() : Number.NaN
  const right = b ? new Date(b).getTime() : Number.NaN
  const leftValid = Number.isFinite(left)
  const rightValid = Number.isFinite(right)
  if (!leftValid && !rightValid) return 0
  if (!leftValid) return 1
  if (!rightValid) return -1
  return left - right
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
    let active = true
    if (initialValue) {
      queueMicrotask(() => {
        if (active) setForm(initialValue)
      })
    }
    return () => {
      active = false
    }
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
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/70"
        onClick={onClose}
        type="button"
      />
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative max-h-[90vh] w-full max-w-[660px] transform-gpu overflow-y-auto rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-8 text-slate-950 shadow-2xl backdrop-blur-xl [scrollbar-width:none] dark:border-white/10 dark:text-white [&::-webkit-scrollbar]:hidden"
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
                  autoComplete="url"
                  className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                  maxLength={2000}
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
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                maxLength={80}
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
                className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                max={100000}
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
                className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                max={100000}
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
                  className="absolute inset-0 bg-slate-950/45 dark:bg-black/70"
                  onClick={() => {
                    if (form.perUserLimit <= 0) updateField('perUserLimit', 1)
                    setShowCustomLimit(false)
                  }}
                  type="button"
                />
                <motion.section
                  animate={{ opacity: 1, y: 0 }}
                  className="relative w-full max-w-[320px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 text-slate-950 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:text-white"
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
                    className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                    max={99}
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
                className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
                max={999999}
                min={-999999}
                onChange={(e) => updateField('sortOrder', Number(e.target.value))}
                type="number"
                value={form.sortOrder}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">领取地点</span>
            <input
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
              maxLength={120}
              onChange={(e) => updateField('pickupLocation', e.target.value)}
              value={form.pickupLocation}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">商品说明 <span className="font-normal text-slate-400">（可选）</span></span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
              maxLength={1000}
              onChange={(e) => updateField('description', e.target.value)}
              value={form.description}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">领取说明</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:placeholder:text-white/30 dark:focus:border-brand-200/60 dark:focus:ring-brand-200/50"
              maxLength={1000}
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

function LedgerText({ value }: { value: string }) {
  return <p className="truncate text-sm text-slate-600 dark:text-slate-300">{value || '—'}</p>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
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
      </div>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}
