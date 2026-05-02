import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  Expand,
  Filter,
  Gift,
  History,
  MapPin,
  PackageCheck,
  Printer,
  ShoppingBag,
  TicketCheck,
  Trophy,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  createRedemption,
  getPointSummary,
  listMallProducts,
  listMyRedemptions,
} from '../../services/mall'
import type { MallProductItem, MallRedemptionItem, PointSummary } from '../../services/mall'

const categoryOptions = ['全部商品', '实体奖励', '学习权益', '证书周边']
const sortOptions = ['默认排序', '积分从低到高', '积分从高到低', '库存优先']

const categoryStyles: Record<string, string> = {
  实体奖励: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  学习权益: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  证书周边: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

const productIcons: Record<string, typeof BookOpen> = {
  实体奖励: BookOpen,
  学习权益: PackageCheck,
  证书周边: Printer,
}

export function UserPointsMall() {
  const [products, setProducts] = useState<MallProductItem[]>([])
  const [redemptions, setRedemptions] = useState<MallRedemptionItem[]>([])
  const [summary, setSummary] = useState<PointSummary | null>(null)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部商品')
  const [sort, setSort] = useState('默认排序')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [confirmProduct, setConfirmProduct] = useState<MallProductItem | null>(null)
  const [detailProduct, setDetailProduct] = useState<MallProductItem | null>(null)

  async function loadMall() {
    setError('')
    setLoading(true)
    try {
      const [summaryResponse, productsResponse, redemptionsResponse] = await Promise.all([
        getPointSummary(),
        listMallProducts(),
        listMyRedemptions(),
      ])
      setSummary(summaryResponse)
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

  const mallStats = useMemo(
    () => [
      { label: '当前积分', value: String(summary?.balance ?? 0), hint: '可用于兑换', icon: Trophy },
      { label: '可兑换', value: String(products.filter((item) => item.canRedeem).length), hint: '积分与库存满足', icon: Gift },
      { label: '已兑换', value: String(redemptions.length), hint: '历史申请', icon: PackageCheck },
      { label: '待领取', value: String(summary?.pendingRedemptions ?? 0), hint: '线下领取', icon: Clock3 },
    ],
    [products, redemptions.length, summary],
  )

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    const result = products.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        item.category.toLowerCase().includes(normalizedKeyword)
      const matchesCategory = category === '全部商品' || item.category === category

      return matchesKeyword && matchesCategory
    })

    if (sort === '积分从低到高') return [...result].sort((a, b) => a.pointsCost - b.pointsCost)
    if (sort === '积分从高到低') return [...result].sort((a, b) => b.pointsCost - a.pointsCost)
    if (sort === '库存优先') return [...result].sort((a, b) => b.stock - a.stock)

    return result
  }, [category, keyword, products, sort])

  async function redeemProduct(product: MallProductItem) {
    setError('')
    setMessage('')
    try {
      const redemption = await createRedemption(product.id)
      setRedemptions((current) => [redemption, ...current])
      await loadMall()
      setMessage(`兑换成功，请凭领取码 ${redemption.pickupCode} 前往蓝山工作室领取。`)
      setConfirmProduct(null)
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : '兑换失败')
    }
  }

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="Points Mall"
          eyebrowIcon={<ShoppingBag className="h-3.5 w-3.5" />}
          title="积分商城"
          description="使用漏洞贡献积分兑换学习资料、训练权益和纪念奖励。兑换成功后在蓝山工作室线下领取，不提供邮寄。"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          onClick={() => setRecordsOpen(true)}
          type="button"
        >
          <History className="h-4 w-4" />
          查看兑换记录
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {mallStats.map((item) => {
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
          <SearchInput label="搜索商品" onChange={setKeyword} placeholder="输入商品、权益或分类" value={keyword} />
          <SelectInput label="商品类型" onChange={setCategory} options={categoryOptions} value={category} />
          <SelectInput label="排序方式" onChange={setSort} options={sortOptions} value={sort} />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => {
              setKeyword('')
              setCategory('全部商品')
              setSort('默认排序')
            }}
            type="button"
          >
            <Filter className="h-4 w-4" />
            重置
          </button>
        </div>
      </SurfacePanel>

      {message && (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}
      {error && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {loading && <SurfacePanel className="mt-6 p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载积分商城...</SurfacePanel>}

      {!loading && (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((item) => {
            const Icon = productIcons[item.category] ?? Gift
            const canExchange = item.stock > 0 && item.canRedeem
            const disabledReason = item.stock <= 0 ? '库存不足' : '积分不足'

            return (
              <SurfacePanel
                className="cursor-pointer overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]"
                key={item.id}
                onClick={() => setDetailProduct(item)}
              >
                <div className="relative h-52 overflow-hidden bg-gradient-to-br from-emerald-100 via-white to-slate-100 dark:from-emerald-950/50 dark:via-white/[0.06] dark:to-slate-900">
                  {item.imageUrl ? (
                    <img alt={item.name} className="h-full w-full object-contain" src={item.imageUrl} />
                  ) : (
                    <>
                      <div className="absolute inset-5 rounded-lg border border-white/70 bg-white/35 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.05]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-white/70 bg-white/70 text-brand-700 shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-green-300">
                          <Icon className="h-9 w-9" />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[item.category] ?? categoryStyles.实体奖励}`}>
                      {item.category}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">库存 {item.stock}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight">{item.name}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>

                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-black/10 pt-4 dark:border-white/10">
                    <div>
                      <p className="text-2xl font-semibold text-brand-700 dark:text-green-300">{item.pointsCost}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">积分</p>
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
                      disabled={!canExchange}
                      onClick={(e) => { e.stopPropagation(); setConfirmProduct(item) }}
                      type="button"
                    >
                      {canExchange ? (
                        <>
                          <TicketCheck className="h-4 w-4" />
                          兑换
                        </>
                      ) : (
                        disabledReason
                      )}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>领取地点：{item.pickupLocation}</span>
                    <span>{item.perUserLimit === 0 ? '无限制' : `限兑 ${item.perUserLimit} 次`}</span>
                  </div>
                </div>
              </SurfacePanel>
            )
          })}
        </div>
      )}

      {!loading && filteredProducts.length === 0 && (
        <EmptyState icon={<CheckCircle2 className="h-10 w-10" />} title="没有匹配的商品" description="调整关键词、商品类型或排序方式后再试一次。" />
      )}

      <SurfacePanel className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <Award className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-green-300" />
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            积分仅用于平台内激励兑换，不具备现金价值。兑换成功后采用蓝山工作室线下领取，不提供邮寄。存在违规测试、虚假提交、重复刷分等行为时，管理员可取消兑换申请并追溯积分流水。
          </p>
        </div>
      </SurfacePanel>

      <RecordsModal open={recordsOpen} redemptions={redemptions} onClose={() => setRecordsOpen(false)} />
      <ConfirmRedeemModal
        product={confirmProduct}
        onCancel={() => setConfirmProduct(null)}
        onConfirm={(product) => void redeemProduct(product)}
      />
      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onRedeem={(product) => {
          setDetailProduct(null)
          setConfirmProduct(product)
        }}
      />
    </PageSection>
  )
}

function RecordsModal({
  onClose,
  open,
  redemptions,
}: {
  onClose: () => void
  open: boolean
  redemptions: MallRedemptionItem[]
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="max-h-[82vh] w-full max-w-[860px] overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-700 dark:text-green-300">Redemption Records</p>
            <h2 className="mt-2 text-2xl font-semibold">兑换记录</h2>
          </div>
          <button className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {redemptions.map((item) => (
            <div className="rounded-lg border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{item.product.name}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    领取码 {item.pickupCode} · {item.pointsCost} 积分 · {formatDate(item.requestedAt)}
                  </p>
                </div>
                <span className="rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-700 dark:text-green-300">
                  {item.statusLabel}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{item.note || `请前往${item.product.pickupLocation}领取。`}</p>
            </div>
          ))}
          {redemptions.length === 0 && <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">暂无兑换记录</p>}
        </div>
      </div>
    </div>
  )
}

function ConfirmRedeemModal({
  onCancel,
  onConfirm,
  product,
}: {
  onCancel: () => void
  onConfirm: (product: MallProductItem) => void
  product: MallProductItem | null
}) {
  if (!product) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <h2 className="text-xl font-semibold">确认兑换</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          将消耗 {product.pointsCost} 积分兑换「{product.name}」。兑换成功后，请凭领取码前往蓝山工作室线下领取。
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={onCancel} type="button">
            取消
          </button>
          <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700" onClick={() => onConfirm(product)} type="button">
            确认兑换
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductDetailModal({
  onClose,
  onRedeem,
  product,
}: {
  onClose: () => void
  onRedeem: (product: MallProductItem) => void
  product: MallProductItem | null
}) {
  if (!product) return null

  const Icon = productIcons[product.category] ?? Gift
  const canExchange = product.stock > 0 && product.canRedeem
  const disabledReason = product.stock <= 0 ? '库存不足' : '积分不足'
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('auth-modal-open')
    return () => document.documentElement.classList.remove('auth-modal-open')
  }, [])

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
        className="relative max-h-[88vh] w-full max-w-[420px] transform-gpu overflow-y-auto rounded-lg border border-black/10 bg-white/95 p-8 text-slate-950 shadow-2xl backdrop-blur-xl [scrollbar-width:none] dark:border-white/10 dark:bg-[#111411]/95 dark:text-white [&::-webkit-scrollbar]:hidden"
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

        {/* 商品图片 */}
        <div className="group relative mb-6 -mx-8 -mt-8 h-44 overflow-hidden rounded-t-lg bg-gradient-to-br from-emerald-100 via-white to-slate-100 dark:from-emerald-950/50 dark:via-white/[0.06] dark:to-slate-900">
          {product.imageUrl ? (
            <>
              <img alt={product.name} className="h-full w-full object-contain" src={product.imageUrl} />
              <button
                className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/20"
                onClick={() => setLightbox(true)}
                type="button"
              >
                <Expand className="h-8 w-8 text-white opacity-0 transition group-hover:opacity-100" />
              </button>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/70 bg-white/70 text-brand-700 shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-green-300">
                <Icon className="h-8 w-8" />
              </div>
            </div>
          )}
        </div>

        {/* 图片灯箱 */}
        {lightbox && product.imageUrl && (
          <div className="fixed inset-0 z-[200] isolate flex items-center justify-center p-4">
            <button
              aria-label="关闭"
              className="absolute inset-0 bg-black/85"
              onClick={() => setLightbox(false)}
              type="button"
            />
            <button
              aria-label="关闭"
              className="absolute right-4 top-4 rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => setLightbox(false)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              alt={product.name}
              className="relative max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              src={product.imageUrl}
            />
          </div>
        )}

        {/* 商品信息 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[product.category] ?? categoryStyles.实体奖励}`}>
            {product.category}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">库存 {product.stock}</span>
        </div>

        <h2 className="text-xl font-semibold tracking-tight">{product.name}</h2>

        {product.description && (
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{product.description}</p>
        )}

        {/* 积分醒目显示 */}
        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-brand-700 dark:text-green-300">{product.pointsCost}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">积分</span>
        </div>

        {/* 详情列表 */}
        <div className="mt-5 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">每人限兑</span>
            <span className="font-medium">{product.perUserLimit === 0 ? '无限制' : `${product.perUserLimit} 次`}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">领取地点</span>
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {product.pickupLocation}
            </span>
          </div>
          {product.pickupInstructions && (
            <div className="px-4 py-3 text-sm">
              <span className="text-slate-500 dark:text-slate-400">领取说明</span>
              <p className="mt-1 leading-6 text-slate-700 dark:text-slate-300">{product.pickupInstructions}</p>
            </div>
          )}
        </div>

        {/* 兑换按钮 */}
        <button
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
          disabled={!canExchange}
          onClick={() => onRedeem(product)}
          type="button"
        >
          {canExchange ? (
            <>
              <TicketCheck className="h-4 w-4" />
              兑换
            </>
          ) : (
            disabledReason
          )}
        </button>
      </motion.section>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN')
}
