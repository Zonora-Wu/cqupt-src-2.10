import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  FileSignature,
  Filter,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  getManagedUserDetail,
  getUserManagementOptions,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUserAiQuota,
  updateManagedUserRole,
  updateManagedUserStatus,
} from '../../services/users'
import type { ManagedUserDetail, ManagedUserItem, RoleCode, UserManagementOptions, UserStatusCode } from '../../services/users'

type ConfirmAction = {
  confirmLabel?: string
  danger?: boolean
  description: string
  onConfirm: () => Promise<void>
  title: string
} | null

const roleOptions = ['全部角色', '学生用户', '审核员', '管理员']
const accountStatusOptions = ['全部状态', '正常', '待准入', '已禁用', '已锁定']
const accessStatusOptions = ['全部准入', '未答题', '答题通过', '已签责任书', '未通过']

const roleClassMap: Record<RoleCode, string> = {
  ADMIN: 'border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  AUDITOR: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  STUDENT: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

const statusClassMap: Record<string, string> = {
  已禁用: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  已锁定: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  待准入: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  正常: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

const accessClassMap: Record<string, string> = {
  已签责任书: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-brand-300',
  未答题: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  未通过: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  答题通过: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
}

const aiQuotaPeriodLabels: Record<'DAY' | 'WEEK' | 'MONTH', string> = {
  DAY: '日额度',
  MONTH: '月额度',
  WEEK: '周额度',
}

export function AdminUserManagement() {
  const [users, setUsers] = useState<ManagedUserItem[]>([])
  const [options, setOptions] = useState<UserManagementOptions | null>(null)
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('全部角色')
  const [accountStatus, setAccountStatus] = useState('全部状态')
  const [accessStatus, setAccessStatus] = useState('全部准入')
  const [college, setCollege] = useState('全部单位')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<ManagedUserDetail | null>(null)
  const [roleUser, setRoleUser] = useState<ManagedUserItem | ManagedUserDetail | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [resetPasswordTarget, setResetPasswordTarget] = useState<ManagedUserItem | ManagedUserDetail | null>(null)
  const [aiQuotaTarget, setAiQuotaTarget] = useState<ManagedUserItem | ManagedUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadUsers() {
    setError('')
    setLoading(true)
    try {
      const [userResponse, optionResponse] = await Promise.all([listManagedUsers(), getUserManagementOptions()])
      setUsers(userResponse.items)
      setOptions(optionResponse)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '用户管理数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    setError('')
    setDetailLoading(true)
    try {
      const detail = await getManagedUserDetail(id)
      setSelectedUser(detail)
      setSelectedId(id)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : '用户详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const collegeOptions = useMemo(() => ['全部单位', ...(options?.colleges ?? [])], [options])

  const summary = useMemo(
    () => [
      { label: '全部用户', value: users.length, hint: '未删除账号' },
      { label: '学生', value: users.filter((item) => item.role === 'STUDENT').length, hint: '提交与学习' },
      { label: '审核员', value: users.filter((item) => item.role === 'AUDITOR').length, hint: '审核与公告' },
      { label: '待准入', value: users.filter((item) => item.status === 'PENDING').length, hint: '需完成准入' },
    ],
    [users],
  )

  const filteredUsers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return users.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.unifiedCode.toLowerCase().includes(normalizedKeyword) ||
        item.email.toLowerCase().includes(normalizedKeyword) ||
        item.college.toLowerCase().includes(normalizedKeyword) ||
        item.studentNo.toLowerCase().includes(normalizedKeyword)
      const matchesRole = role === '全部角色' || item.roleLabel === role
      const matchesStatus = accountStatus === '全部状态' || item.accountStatus === accountStatus
      const matchesAccess = accessStatus === '全部准入' || item.accessStatus === accessStatus
      const matchesCollege = college === '全部单位' || item.college === college
      return matchesKeyword && matchesRole && matchesStatus && matchesAccess && matchesCollege
    })
  }, [accountStatus, accessStatus, college, keyword, role, users])

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

  function mergeUpdatedUser(updated: ManagedUserItem) {
    setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    if (selectedUser?.id === updated.id) {
      void loadDetail(updated.id)
    }
  }

  async function runStatusAction(id: string, status: UserStatusCode, reason: string, successMessage: string) {
    setError('')
    try {
      const updated = await updateManagedUserStatus(id, status, reason)
      mergeUpdatedUser(updated)
      flashMessage(successMessage)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }

  async function runPasswordReset(id: string, newPassword: string) {
    setError('')
    try {
      const result = await resetManagedUserPassword(id, newPassword, '管理员从用户管理页发起密码重置')
      flashMessage(result.message ?? '密码已重置')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '密码重置失败')
    }
  }

  async function runAiQuotaUpdate(id: string, quota: { dailyLimit: number; monthlyLimit: number; weeklyLimit: number }, enabled: boolean) {
    setError('')
    try {
      const updated = await updateManagedUserAiQuota(id, quota, enabled, '管理员从用户管理页调整 AI token 额度')
      mergeUpdatedUser(updated)
      flashMessage('AI token 额度已更新')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'AI token 额度更新失败')
    }
  }

  if (selectedId) {
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
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => {
              setSelectedId(null)
              setSelectedUser(null)
            }}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            返回用户列表
          </button>

          {detailLoading && <SurfacePanel className="mt-5 p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载用户详情...</SurfacePanel>}

          {selectedUser && (
            <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                <SurfacePanel className="p-6 text-center">
                  <ManagedUserAvatar user={selectedUser} size="lg" />
                  <h1 className="mt-4 text-2xl font-semibold">{selectedUser.name}</h1>
                  <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{selectedUser.unifiedCode}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <RoleBadge user={selectedUser} />
                    <SimpleBadge className={statusClassMap[selectedUser.accountStatus]}>{selectedUser.accountStatus}</SimpleBadge>
                    <SimpleBadge className={accessClassMap[selectedUser.accessStatus]}>{selectedUser.accessStatus}</SimpleBadge>
                  </div>
                  <div className="mt-5 space-y-3 text-left text-sm text-slate-600 dark:text-slate-400">
                    <p>邮箱验证：{selectedUser.emailVerified ? '已验证' : '未验证'}</p>
                    <p>责任书：{selectedUser.responsibilitySigned ? '已签署' : '未签署'}</p>
                    <p>最近登录：{formatDateTime(selectedUser.lastLogin)}</p>
                    <p>最近 IP：{selectedUser.lastIp || '暂无记录'}</p>
                  </div>
                </SurfacePanel>

                <SurfacePanel className="p-4">
                  <div className="grid gap-2">
                    {selectedUser.role !== 'ADMIN' && (
                      <button
                        className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                        onClick={() => setRoleUser(selectedUser)}
                        type="button"
                      >
                        调整角色
                      </button>
                    )}
                    <ActionButton
                      label="重置密码"
                      onClick={() => setResetPasswordTarget(selectedUser)}
                    />
                    <ActionButton
                      label="设置 AI 额度"
                      onClick={() => setAiQuotaTarget(selectedUser)}
                    />
                    {selectedUser.role !== 'ADMIN' && (
                      <ActionButton
                        label={selectedUser.status === 'LOCKED' ? '解锁账号' : '锁定账号'}
                        onClick={() =>
                          setConfirmAction({
                            description:
                              selectedUser.status === 'LOCKED'
                                ? '解锁后用户可以重新登录平台。'
                                : '锁定后用户暂时无法登录，适合处理异常登录或疑似盗号。',
                            onConfirm: () =>
                              runStatusAction(
                                selectedUser.id,
                                selectedUser.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED',
                                selectedUser.status === 'LOCKED' ? '管理员解锁账号' : '管理员锁定账号',
                                selectedUser.status === 'LOCKED' ? '账号已解锁' : '账号已锁定',
                              ),
                            title: selectedUser.status === 'LOCKED' ? '确认解锁账号？' : '确认锁定账号？',
                          })
                        }
                      />
                    )}
                    {selectedUser.role !== 'ADMIN' && (
                      <ActionButton
                        danger
                        label={selectedUser.status === 'DISABLED' ? '启用账号' : '禁用账号'}
                        onClick={() =>
                          setConfirmAction({
                            danger: selectedUser.status !== 'DISABLED',
                            description:
                              selectedUser.status === 'DISABLED'
                                ? '启用后用户可以恢复登录和使用对应角色权限。'
                                : '禁用后用户无法登录，未完成流程不会删除。',
                            onConfirm: () =>
                              runStatusAction(
                                selectedUser.id,
                                selectedUser.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED',
                                selectedUser.status === 'DISABLED' ? '管理员启用账号' : '管理员禁用账号',
                                selectedUser.status === 'DISABLED' ? '账号已启用' : '账号已禁用',
                              ),
                            title: selectedUser.status === 'DISABLED' ? '确认启用账号？' : '确认禁用账号？',
                          })
                        }
                      />
                    )}
                    {selectedUser.role === 'ADMIN' && (
                      <p className="px-1 text-xs text-slate-400 dark:text-slate-500">管理员账号不可调整角色、锁定或禁用</p>
                    )}
                  </div>
                </SurfacePanel>
              </div>

              <div className="space-y-6">
                <DetailPanel title="基础信息" icon={<UserRound className="h-5 w-5" />}>
                  <InfoGrid
                    rows={[
                      ['姓名', selectedUser.name],
                      ['统一认证码', selectedUser.unifiedCode],
                      ['邮箱', selectedUser.email],
                      ['学号', selectedUser.studentNo || '未填写'],
                      ['学院 / 单位', selectedUser.college || '未填写'],
                      ['年级', selectedUser.grade || '未填写'],
                      ['身份说明', selectedUser.identityText || '未填写'],
                      ['授权等级', selectedUser.authorizationLevel],
                      ['注册时间', formatDateTime(selectedUser.createdAt)],
                    ]}
                  />
                </DetailPanel>

                <DetailPanel title="准入与责任书" icon={<FileSignature className="h-5 w-5" />}>
                  <InfoGrid
                    rows={[
                      ['答题分数', selectedUser.securityExamScore === null ? '未答题' : `${selectedUser.securityExamScore} 分`],
                      ['答题时间', formatDateTime(selectedUser.securityExamTime)],
                      ['是否通过', selectedUser.securityExamPassed ? '已通过' : '未通过或未答题'],
                      ['责任书版本', selectedUser.responsibilityVersion || '未签署'],
                      ['签署时间', formatDateTime(selectedUser.responsibilitySignedAt)],
                      ['允许提交漏洞', selectedUser.responsibilitySigned && selectedUser.emailVerified ? '满足基础条件' : '不满足'],
                    ]}
                  />
                </DetailPanel>

                <DetailPanel title="贡献数据" icon={<ShieldCheck className="h-5 w-5" />}>
                  <div className="grid gap-3 md:grid-cols-5">
                    {[
                      ['累计提交', selectedUser.submissions],
                      ['有效漏洞', selectedUser.validReports],
                      ['当前积分', selectedUser.points],
                      ['证书数量', selectedUser.certificates],
                      ['权限覆盖', selectedUser.permissionOverrides.length],
                    ].map(([label, value]) => (
                      <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 " key={label}>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                        <p className="mt-2 text-xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </DetailPanel>

                <DetailPanel title="AI token 额度" icon={<Bot className="h-5 w-5" />}>
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      [aiQuotaPeriodLabels[selectedUser.aiQuota.quotaPeriod], formatNumber(selectedUser.aiQuota.activeLimit)],
                      ['本周期已用', formatNumber(selectedUser.aiQuota.usedThisPeriod)],
                      ['剩余额度', formatNumber(selectedUser.aiQuota.remaining)],
                      ['状态', selectedUser.aiQuota.enabled ? '已启用' : '已停用'],
                    ].map(([label, value]) => (
                      <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 " key={label}>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                        <p className="mt-2 text-xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 text-sm dark:border-white/10 ">
                    <p className="text-slate-500 dark:text-slate-400">
                      {selectedUser.aiQuota.overridden ? '该用户使用单独配置额度。' : '该用户使用系统默认额度。'}
                      日/周/月额度：{formatNumber(selectedUser.aiQuota.dailyLimit)} / {formatNumber(selectedUser.aiQuota.weeklyLimit)} / {formatNumber(selectedUser.aiQuota.monthlyLimit)}。
                      下次重置：{formatDateTime(selectedUser.aiQuota.resetAt)}
                    </p>
                    <button
                      className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                      onClick={() => setAiQuotaTarget(selectedUser)}
                      type="button"
                    >
                      调整额度
                    </button>
                  </div>
                </DetailPanel>

                <DetailPanel title="权限覆盖" icon={<KeyRound className="h-5 w-5" />}>
                  <div className="space-y-3">
                    {selectedUser.permissionOverrides.map((item) => (
                      <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 " key={item.code}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.name}</p>
                          <SimpleBadge className={item.enabled ? statusClassMap.正常 : statusClassMap.已禁用}>
                            {item.enabled ? '开启' : '关闭'}
                          </SimpleBadge>
                        </div>
                        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{item.code}</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.reason || '无备注'}</p>
                      </div>
                    ))}
                    {selectedUser.permissionOverrides.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">暂无用户级权限覆盖。</p>}
                  </div>
                </DetailPanel>

                <DetailPanel title="最近审计" icon={<LockKeyhole className="h-5 w-5" />}>
                  <div className="space-y-4">
                    {selectedUser.auditEvents.map((event) => (
                      <div className="border-l border-brand-600/30 pl-4" key={`${event.action}-${event.createdAt}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{event.action}</p>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(event.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {event.targetType} · {event.result}
                        </p>
                      </div>
                    ))}
                  </div>
                </DetailPanel>
              </div>
            </div>
          )}
        </section>

        <RoleModal
          options={options}
          user={roleUser}
          onClose={() => setRoleUser(null)}
          onConfirm={async (target, nextRole, reason) => {
            const updated = await updateManagedUserRole(target.id, nextRole, reason)
            mergeUpdatedUser(updated)
            flashMessage('角色已调整')
          }}
        />
        <ConfirmDialog state={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={confirmAndClose} />
        <AiQuotaDialog
          onClose={() => setAiQuotaTarget(null)}
          onConfirm={async (target, quota, enabled) => {
            await runAiQuotaUpdate(target.id, quota, enabled)
            setAiQuotaTarget(null)
          }}
          user={aiQuotaTarget}
        />
      </>
    )
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
            eyebrow="User Ops"
            eyebrowIcon={<UsersRound className="h-3.5 w-3.5" />}
            title="用户管理"
            description="管理学生、审核员和管理员账号，处理准入状态、责任书、角色权限与账号安全。"
          />
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

        <SurfacePanel className="relative z-30 mt-6 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_150px_150px_170px_220px_auto] xl:items-end">
            <SearchInput label="搜索用户" onChange={setKeyword} placeholder="姓名、统一认证码、邮箱、学院或学号" value={keyword} />
            <SelectInput label="用户角色" onChange={setRole} options={roleOptions} value={role} />
            <SelectInput label="账号状态" onChange={setAccountStatus} options={accountStatusOptions} value={accountStatus} />
            <SelectInput label="准入状态" onChange={setAccessStatus} options={accessStatusOptions} value={accessStatus} />
            <SelectInput label="学院 / 单位" onChange={setCollege} options={collegeOptions} value={college} />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => {
                setKeyword('')
                setRole('全部角色')
                setAccountStatus('全部状态')
                setAccessStatus('全部准入')
                setCollege('全部单位')
              }}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
        </SurfacePanel>

        {loading && <SurfacePanel className="mt-6 p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载用户列表...</SurfacePanel>}

        {!loading && (
          <div className="mt-5 grid gap-3">
            {filteredUsers.map((item) => (
              <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
                  <div className="flex gap-3">
                    <ManagedUserAvatar user={item} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">{item.name}</h2>
                        <RoleBadge user={item} />
                        <SimpleBadge className={statusClassMap[item.accountStatus]}>{item.accountStatus}</SimpleBadge>
                        <SimpleBadge className={accessClassMap[item.accessStatus]}>{item.accessStatus}</SimpleBadge>
                      </div>
                      <div className="mt-2 grid gap-x-5 gap-y-1 text-sm text-slate-500 sm:grid-cols-2 xl:grid-cols-4 dark:text-slate-400">
                        <p>统一认证码：{item.unifiedCode}</p>
                        <p>邮箱：{item.email}</p>
                        <p>学院 / 单位：{item.college || '未填写'}</p>
                        <p>学号：{item.studentNo || '未填写'}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>提交 {item.submissions}</span>
                        <span>有效 {item.validReports}</span>
                        <span>积分 {item.points}</span>
                        <span>AI 剩余 {formatNumber(item.aiQuota.remaining)}</span>
                        <span>证书 {item.certificates}</span>
                        <span>最近登录 {formatDateTime(item.lastLogin)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 dark:border-white/10 ">
                    <div className="grid gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <p>邮箱：{item.emailVerified ? '已验证' : '未验证'}</p>
                      <p>责任书：{item.responsibilitySigned ? '已签署' : '未签署'}</p>
                      <p>最近 IP：{item.lastIp || '暂无记录'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-white/10">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="h-4 w-4" />
                    角色、状态、密码重置操作会写入审计日志
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.role !== 'ADMIN' && (
                      <button
                        className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        onClick={() => setRoleUser(item)}
                        type="button"
                      >
                        调整角色
                      </button>
                    )}
                    <button
                      className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      onClick={() => setResetPasswordTarget(item)}
                      type="button"
                    >
                      重置密码
                    </button>
                    <button
                      className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      onClick={() => setAiQuotaTarget(item)}
                      type="button"
                    >
                      AI 额度
                    </button>
                    <button className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700" onClick={() => void loadDetail(item.id)} type="button">
                      查看详情
                    </button>
                  </div>
                </div>
              </SurfacePanel>
            ))}
          </div>
        )}

        {!loading && filteredUsers.length === 0 && (
          <EmptyState icon={<AlertTriangle className="h-10 w-10" />} title="没有匹配的用户" description="调整关键词、角色、状态或学院后再试一次。" />
        )}
      </section>

      <ResetPasswordDialog
        onClose={() => setResetPasswordTarget(null)}
        onConfirm={async (user, newPassword) => {
          await runPasswordReset(user.id, newPassword)
          setResetPasswordTarget(null)
        }}
        user={resetPasswordTarget}
      />
      <RoleModal
        options={options}
        user={roleUser}
        onClose={() => setRoleUser(null)}
        onConfirm={async (target, nextRole, reason) => {
          const updated = await updateManagedUserRole(target.id, nextRole, reason)
          mergeUpdatedUser(updated)
          flashMessage('角色已调整')
        }}
      />
      <ConfirmDialog state={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={confirmAndClose} />
      <AiQuotaDialog
        onClose={() => setAiQuotaTarget(null)}
        onConfirm={async (target, quota, enabled) => {
          await runAiQuotaUpdate(target.id, quota, enabled)
          setAiQuotaTarget(null)
        }}
        user={aiQuotaTarget}
      />
    </>
  )

  function confirmAndClose() {
    const action = confirmAction?.onConfirm
    setConfirmAction(null)
    if (action) void action()
  }
}

function RoleBadge({ user }: { user: ManagedUserItem | ManagedUserDetail }) {
  return <SimpleBadge className={roleClassMap[user.role]}>{user.roleLabel}</SimpleBadge>
}

function ManagedUserAvatar({ size = 'md', user }: { size?: 'lg' | 'md'; user: ManagedUserItem | ManagedUserDetail }) {
  const sizeClass = size === 'lg' ? 'h-24 w-24 text-2xl' : 'h-12 w-12 text-base'
  const firstLetter = user.name.trim().slice(0, 1) || user.unifiedCode.slice(0, 1) || '用'

  return (
    <div
      className={`${size === 'lg' ? 'mx-auto' : ''} flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-brand-600 font-semibold text-white dark:border-white/10`}
    >
      {user.avatarUrl ? (
        <img alt={`${user.name} 头像`} className="h-full w-full object-cover" src={user.avatarUrl} />
      ) : (
        firstLetter
      )}
    </div>
  )
}

function SimpleBadge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{children}</span>
}

function ActionButton({ danger = false, label, onClick }: { danger?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
        danger
          ? 'border-red-500/20 text-red-700 hover:bg-red-500/10 dark:text-red-300'
          : 'border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function DetailPanel({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <SurfacePanel className="p-6">
      <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
        {icon}
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </SurfacePanel>
  )
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 " key={label}>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 font-medium">{value}</p>
        </div>
      ))}
    </div>
  )
}

function RoleModal({
  onClose,
  onConfirm,
  options,
  user,
}: {
  onClose: () => void
  onConfirm: (user: ManagedUserItem | ManagedUserDetail, nextRole: RoleCode, reason: string) => Promise<void>
  options: UserManagementOptions | null
  user: ManagedUserItem | ManagedUserDetail | null
}) {
  const [nextRole, setNextRole] = useState<RoleCode>('STUDENT')
  const [reason, setReason] = useState('管理员调整用户角色')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) setNextRole(user.role)
  }, [user])

  if (!user) return null

  async function submit() {
    setSaving(true)
    try {
      await onConfirm(user, nextRole, reason)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const roleSelectOptions = options?.roles.map((item) => item.label) ?? ['学生用户', '审核员', '管理员']
  const roleByLabel = new Map((options?.roles ?? []).map((item) => [item.label, item.code]))

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[620px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
              <UserCog className="h-5 w-5" />
              <span className="text-sm font-medium">Role Management</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">调整用户角色</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              当前用户为 {user.name}，现有角色是「{user.roleLabel}」。用户只能拥有一个角色。
            </p>
          </div>
          <button className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <SelectInput
            label="新角色"
            onChange={(value) => setNextRole(roleByLabel.get(value) ?? 'STUDENT')}
            options={roleSelectOptions}
            value={(options?.roles.find((item) => item.code === nextRole)?.label ?? user.roleLabel)}
          />
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">管理员备注</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
              onChange={(event) => setReason(event.target.value)}
              placeholder="填写角色调整原因，便于审计追踪"
              value={reason}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={onClose} type="button">
            取消
          </button>
          <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={saving} onClick={() => void submit()} type="button">
            {saving ? '保存中...' : '确认调整'}
          </button>
        </div>
      </div>
    </div>
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
            {state.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordDialog({
  onClose,
  onConfirm,
  user,
}: {
  onClose: () => void
  onConfirm: (user: ManagedUserItem | ManagedUserDetail, newPassword: string) => Promise<void>
  user: ManagedUserItem | ManagedUserDetail | null
}) {
  const defaultPassword = user ? `tmp${user.unifiedCode}` : ''
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (user) {
      setPassword(`tmp${user.unifiedCode}`)
      setValidationError('')
    }
  }, [user])

  if (!user) return null

  function validate(value: string) {
    if (value.length < 8) return '密码至少需要 8 个字符'
    const categories = [/[A-Za-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length
    if (categories < 2) return '密码需包含字母、数字、符号中至少两类'
    return ''
  }

  async function submit() {
    const err = validate(password)
    if (err) { setValidationError(err); return }
    setSaving(true)
    try {
      await onConfirm(user, password)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
              <KeyRound className="h-5 w-5" />
              <span className="text-sm font-medium">Reset Password</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">重置密码</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              为 <span className="font-medium text-slate-800 dark:text-slate-200">{user.name}</span>（{user.unifiedCode}）设置新密码。重置后旧登录态会立即失效。
            </p>
          </div>
          <button className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">新密码</span>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">默认为 tmp + 统一码，可直接点确认或修改后再确认</p>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
              onChange={(e) => { setPassword(e.target.value); setValidationError('') }}
              placeholder={defaultPassword}
              type="text"
              value={password}
            />
            {validationError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{validationError}</p>}
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={onClose} type="button">
            取消
          </button>
          <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={saving} onClick={() => void submit()} type="button">
            {saving ? '重置中...' : '确认重置'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AiQuotaDialog({
  onClose,
  onConfirm,
  user,
}: {
  onClose: () => void
  onConfirm: (user: ManagedUserItem | ManagedUserDetail, quota: { dailyLimit: number; monthlyLimit: number; weeklyLimit: number }, enabled: boolean) => Promise<void>
  user: ManagedUserItem | ManagedUserDetail | null
}) {
  const [dailyLimit, setDailyLimit] = useState('')
  const [weeklyLimit, setWeeklyLimit] = useState('')
  const [monthlyLimit, setMonthlyLimit] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (user) {
      const monthly = normalizeQuotaInputValue(user.aiQuota.monthlyLimit)
      setDailyLimit(normalizeQuotaInputValue(user.aiQuota.dailyLimit, monthly))
      setWeeklyLimit(normalizeQuotaInputValue(user.aiQuota.weeklyLimit, monthly))
      setMonthlyLimit(monthly)
      setEnabled(user.aiQuota.enabled)
      setValidationError('')
    }
  }, [user])

  if (!user) return null

  async function submit() {
    const nextDailyLimit = Number(dailyLimit)
    const nextWeeklyLimit = Number(weeklyLimit)
    const nextMonthlyLimit = Number(monthlyLimit)
    if (![nextDailyLimit, nextWeeklyLimit, nextMonthlyLimit].every((value) => Number.isInteger(value) && value >= 0)) {
      setValidationError('请输入有效的非负整数额度')
      return
    }

    setSaving(true)
    try {
      await onConfirm(user, { dailyLimit: nextDailyLimit, monthlyLimit: nextMonthlyLimit, weeklyLimit: nextWeeklyLimit }, enabled)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[560px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
              <Bot className="h-5 w-5" />
              <span className="text-sm font-medium">AI Quota</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">设置 AI token 额度</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              为 {user.name}（{user.unifiedCode}）设置独立日、周、月额度。保存后该用户不再使用系统默认额度。
            </p>
          </div>
          <button className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">日 token 额度</span>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
              onChange={(e) => { setDailyLimit(e.target.value); setValidationError('') }}
              type="number"
              value={dailyLimit}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">周 token 额度</span>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
              onChange={(e) => { setWeeklyLimit(e.target.value); setValidationError('') }}
              type="number"
              value={weeklyLimit}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">月 token 额度</span>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
              onChange={(e) => { setMonthlyLimit(e.target.value); setValidationError('') }}
              type="number"
              value={monthlyLimit}
            />
          </label>
          {validationError && <p className="-mt-2 text-xs text-red-600 dark:text-red-400">{validationError}</p>}
          <button
            aria-pressed={enabled}
            className="flex items-center justify-between rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] px-4 py-3 text-sm transition hover:bg-white/90 dark:border-white/10  dark:hover:bg-white/[0.07]"
            onClick={() => setEnabled((value) => !value)}
            type="button"
          >
            <span>
              <span className="block font-medium">允许使用邮宝</span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">关闭后该用户无法发起邮宝对话</span>
            </span>
            <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20'}`}>
              <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
          </button>
          <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 text-sm text-slate-500 dark:border-white/10  dark:text-slate-400">
            当前按{aiQuotaPeriodLabels[user.aiQuota.quotaPeriod]}统计，已用 {formatNumber(user.aiQuota.usedThisPeriod)}，剩余 {formatNumber(user.aiQuota.remaining)}，下次重置 {formatDateTime(user.aiQuota.resetAt)}。
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={onClose} type="button">
            取消
          </button>
          <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={saving} onClick={() => void submit()} type="button">
            {saving ? '保存中...' : '确认保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function normalizeQuotaInputValue(value: unknown, fallback = '0') {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? String(numberValue) : fallback
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('zh-CN')
}
