import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  Filter,
  LockKeyhole,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

type UserRole = '学生' | '审核员' | '管理员'
type AccountStatus = '正常' | '待准入' | '已禁用' | '已锁定'
type AccessStatus = '未答题' | '答题通过' | '已签责任书' | '未通过'

type AdminUser = {
  id: string
  name: string
  unifiedCode: string
  email: string
  phone: string
  college: string
  major: string
  grade: string
  role: UserRole
  accountStatus: AccountStatus
  accessStatus: AccessStatus
  emailVerified: boolean
  responsibilitySigned: boolean
  responsibilityVersion: string
  responsibilitySignedAt: string
  quizScore: number
  quizTime: string
  submissions: number
  validReports: number
  points: number
  certificates: number
  rank: number
  lastLogin: string
  lastIp: string
  failedLogins: number
  source: '本地注册' | '统一认证同步' | '管理员导入'
  registeredAt: string
  notes: Array<{
    action: string
    actor: string
    time: string
    note: string
  }>
}

type ConfirmAction = {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
} | null

const roleOptions = ['全部角色', '学生', '审核员', '管理员']
const accountStatusOptions = ['全部状态', '正常', '待准入', '已禁用', '已锁定']
const accessStatusOptions = ['全部准入', '未答题', '答题通过', '已签责任书', '未通过']
const collegeOptions = ['全部单位', '网络空间安全与信息法学院', '计算机科学与技术学院', '信息化办公室', '教务处', '团委']

const users: AdminUser[] = [
  {
    id: 'U-2026-0001',
    name: '星火同学',
    unifiedCode: '2025001',
    email: 'spark@example.edu.cn',
    phone: '138****2026',
    college: '网络空间安全与信息法学院',
    major: '网络空间安全',
    grade: '2025 级',
    role: '学生',
    accountStatus: '正常',
    accessStatus: '已签责任书',
    emailVerified: true,
    responsibilitySigned: true,
    responsibilityVersion: 'CQUPT-SRC-RULE-2026-01',
    responsibilitySignedAt: '2026-04-20 19:22',
    quizScore: 92,
    quizTime: '2026-04-20 19:10',
    submissions: 8,
    validReports: 5,
    points: 1260,
    certificates: 2,
    rank: 3,
    lastLogin: '2026-04-28 09:12',
    lastIp: '10.20.18.24',
    failedLogins: 0,
    source: '本地注册',
    registeredAt: '2026-04-19 13:40',
    notes: [
      { action: '完成答题准入', actor: '系统', time: '2026-04-20 19:10', note: '答题得分 92，达到提交漏洞门槛。' },
      { action: '签署责任书', actor: '星火同学', time: '2026-04-20 19:22', note: '签署版本 CQUPT-SRC-RULE-2026-01。' },
      { action: '提交高价值漏洞', actor: '星火同学', time: '2026-04-27 10:24', note: '提交统一认证相关漏洞报告。' },
    ],
  },
  {
    id: 'U-2026-0002',
    name: '审核员 A',
    unifiedCode: '3001001',
    email: 'reviewer-a@example.edu.cn',
    phone: '139****1101',
    college: '信息化办公室',
    major: '安全运维',
    grade: '教职工',
    role: '审核员',
    accountStatus: '正常',
    accessStatus: '已签责任书',
    emailVerified: true,
    responsibilitySigned: true,
    responsibilityVersion: 'CQUPT-SRC-REVIEWER-2026-01',
    responsibilitySignedAt: '2026-04-18 09:30',
    quizScore: 100,
    quizTime: '2026-04-18 09:20',
    submissions: 0,
    validReports: 0,
    points: 0,
    certificates: 0,
    rank: 0,
    lastLogin: '2026-04-28 08:40',
    lastIp: '10.10.2.18',
    failedLogins: 0,
    source: '管理员导入',
    registeredAt: '2026-04-18 09:00',
    notes: [
      { action: '导入账号', actor: '平台管理员', time: '2026-04-18 09:00', note: '创建审核员账号。' },
      { action: '角色授权', actor: '平台管理员', time: '2026-04-18 09:05', note: '授予漏洞审核权限。' },
    ],
  },
  {
    id: 'U-2026-0003',
    name: '南山同学',
    unifiedCode: '2025007',
    email: 'nanshan@example.edu.cn',
    phone: '137****5007',
    college: '计算机科学与技术学院',
    major: '计算机科学与技术',
    grade: '2025 级',
    role: '学生',
    accountStatus: '待准入',
    accessStatus: '答题通过',
    emailVerified: true,
    responsibilitySigned: false,
    responsibilityVersion: '未签署',
    responsibilitySignedAt: '未签署',
    quizScore: 88,
    quizTime: '2026-04-27 21:02',
    submissions: 1,
    validReports: 0,
    points: 0,
    certificates: 0,
    rank: 0,
    lastLogin: '2026-04-27 21:18',
    lastIp: '10.30.9.44',
    failedLogins: 1,
    source: '统一认证同步',
    registeredAt: '2026-04-27 20:50',
    notes: [
      { action: '同步账号', actor: '统一认证', time: '2026-04-27 20:50', note: '从学校身份源同步基础信息。' },
      { action: '完成答题', actor: '南山同学', time: '2026-04-27 21:02', note: '尚未签署责任书。' },
    ],
  },
  {
    id: 'U-2026-0004',
    name: '平台管理员',
    unifiedCode: '0000000',
    email: 'admin@example.edu.cn',
    phone: '136****0000',
    college: '信息化办公室',
    major: '平台管理',
    grade: '管理员',
    role: '管理员',
    accountStatus: '正常',
    accessStatus: '已签责任书',
    emailVerified: true,
    responsibilitySigned: true,
    responsibilityVersion: 'CQUPT-SRC-ADMIN-2026-01',
    responsibilitySignedAt: '2026-04-18 08:30',
    quizScore: 100,
    quizTime: '2026-04-18 08:20',
    submissions: 0,
    validReports: 0,
    points: 0,
    certificates: 0,
    rank: 0,
    lastLogin: '2026-04-28 09:30',
    lastIp: '10.10.1.8',
    failedLogins: 0,
    source: '管理员导入',
    registeredAt: '2026-04-18 08:00',
    notes: [
      { action: '初始化管理员', actor: '系统', time: '2026-04-18 08:00', note: '初始化平台管理员账号。' },
      { action: '修改系统设置', actor: '平台管理员', time: '2026-04-28 09:20', note: '调整 AI 与证书模板配置。' },
    ],
  },
]

const roleClassMap: Record<UserRole, string> = {
  学生: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  审核员: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  管理员: 'border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-300',
}

const accountStatusClassMap: Record<AccountStatus, string> = {
  正常: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  待准入: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  已禁用: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  已锁定: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
}

const accessStatusClassMap: Record<AccessStatus, string> = {
  未答题: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  答题通过: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  已签责任书: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  未通过: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function AdminUserManagement() {
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('全部角色')
  const [accountStatus, setAccountStatus] = useState('全部状态')
  const [accessStatus, setAccessStatus] = useState('全部准入')
  const [college, setCollege] = useState('全部单位')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [roleUser, setRoleUser] = useState<AdminUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionDone, setActionDone] = useState('')

  const filteredUsers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return users.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.unifiedCode.toLowerCase().includes(normalizedKeyword) ||
        item.email.toLowerCase().includes(normalizedKeyword) ||
        item.college.toLowerCase().includes(normalizedKeyword) ||
        item.phone.toLowerCase().includes(normalizedKeyword)
      const matchesRole = role === '全部角色' || item.role === role
      const matchesAccountStatus = accountStatus === '全部状态' || item.accountStatus === accountStatus
      const matchesAccessStatus = accessStatus === '全部准入' || item.accessStatus === accessStatus
      const matchesCollege = college === '全部单位' || item.college === college

      return matchesKeyword && matchesRole && matchesAccountStatus && matchesAccessStatus && matchesCollege
    })
  }, [accountStatus, accessStatus, college, keyword, role])

  const selectedUser = selectedId ? users.find((item) => item.id === selectedId) ?? null : null

  const completeAction = (message: string) => {
    setActionDone(message)
    window.setTimeout(() => setActionDone(''), 2200)
  }

  if (selectedUser) {
    return (
      <>
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => setSelectedId(null)}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            返回用户列表
          </button>

          {actionDone && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {actionDone}
            </div>
          )}

          <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              <SurfacePanel className="p-6 text-center">
                <button
                  className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-black/10 bg-brand-600 text-2xl font-semibold text-white transition hover:scale-[1.02] dark:border-white/10"
                  type="button"
                >
                  {selectedUser.name.slice(0, 1)}
                </button>
                <h1 className="mt-4 text-2xl font-semibold">{selectedUser.name}</h1>
                <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{selectedUser.unifiedCode}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <RoleBadge role={selectedUser.role} />
                  <AccountStatusBadge status={selectedUser.accountStatus} />
                  <AccessStatusBadge status={selectedUser.accessStatus} />
                </div>
                <div className="mt-5 space-y-3 text-left text-sm text-slate-600 dark:text-slate-400">
                  <p>邮箱验证：{selectedUser.emailVerified ? '已验证' : '未验证'}</p>
                  <p>责任书：{selectedUser.responsibilitySigned ? '已签署' : '未签署'}</p>
                  <p>最近登录：{selectedUser.lastLogin}</p>
                  <p>最近 IP：{selectedUser.lastIp}</p>
                </div>
              </SurfacePanel>

              <SurfacePanel className="p-4">
                <div className="grid gap-2">
                  <button
                    className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                    onClick={() => setRoleUser(selectedUser)}
                    type="button"
                  >
                    调整角色
                  </button>
                  <ActionButton
                    label="重置密码"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认重置密码？',
                        description: '重置后系统将生成临时密码或发送重置链接。该操作会写入审计日志，并通知用户尽快修改密码。',
                        onConfirm: () => completeAction('密码重置已记录'),
                      })
                    }
                  />
                  <ActionButton
                    label={selectedUser.accountStatus === '已锁定' ? '解锁账号' : '锁定账号'}
                    onClick={() =>
                      setConfirmAction({
                        title: selectedUser.accountStatus === '已锁定' ? '确认解锁账号？' : '确认锁定账号？',
                        description:
                          selectedUser.accountStatus === '已锁定'
                            ? '解锁后用户可以重新登录平台。建议先确认异常登录风险已经排除。'
                            : '锁定后用户暂时无法登录，适合处理异常登录、疑似盗号或需要临时保护的账号。',
                        onConfirm: () => completeAction(selectedUser.accountStatus === '已锁定' ? '账号已解锁' : '账号已锁定'),
                      })
                    }
                  />
                  <ActionButton
                    danger
                    label={selectedUser.accountStatus === '已禁用' ? '启用账号' : '禁用账号'}
                    onClick={() =>
                      setConfirmAction({
                        title: selectedUser.accountStatus === '已禁用' ? '确认启用账号？' : '确认禁用账号？',
                        description:
                          selectedUser.accountStatus === '已禁用'
                            ? '启用后用户可以恢复登录和使用对应角色权限。'
                            : '禁用后用户将无法登录平台，未完成的漏洞流程不会删除，但该用户不能继续提交或补充材料。',
                        danger: selectedUser.accountStatus !== '已禁用',
                        onConfirm: () => completeAction(selectedUser.accountStatus === '已禁用' ? '账号已启用' : '账号已禁用'),
                      })
                    }
                  />
                  <ActionButton
                    label="重新发送验证邮件"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认重新发送验证邮件？',
                        description: `系统将向 ${selectedUser.email} 发送验证邮件。请确认邮箱地址准确。`,
                        onConfirm: () => completeAction('验证邮件已发送'),
                      })
                    }
                  />
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
                    ['手机号', selectedUser.phone],
                    ['学院 / 单位', selectedUser.college],
                    ['专业', selectedUser.major],
                    ['年级', selectedUser.grade],
                    ['注册来源', selectedUser.source],
                    ['注册时间', selectedUser.registeredAt],
                  ]}
                />
              </DetailPanel>

              <DetailPanel title="准入与责任书" icon={<FileSignature className="h-5 w-5" />}>
                <InfoGrid
                  rows={[
                    ['答题分数', `${selectedUser.quizScore} 分`],
                    ['答题时间', selectedUser.quizTime],
                    ['是否达标', selectedUser.quizScore >= 80 ? '已达标' : '未达标'],
                    ['责任书版本', selectedUser.responsibilityVersion],
                    ['签署时间', selectedUser.responsibilitySignedAt],
                    ['允许提交漏洞', selectedUser.responsibilitySigned && selectedUser.quizScore >= 80 ? '允许' : '不允许'],
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
                    ['排行榜', selectedUser.rank ? `第 ${selectedUser.rank} 名` : '未上榜'],
                  ].map(([label, value]) => (
                    <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]" key={label}>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="mt-2 text-xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </DetailPanel>

              <DetailPanel title="账号安全" icon={<LockKeyhole className="h-5 w-5" />}>
                <InfoGrid
                  rows={[
                    ['最近登录', selectedUser.lastLogin],
                    ['最近登录 IP', selectedUser.lastIp],
                    ['登录失败次数', `${selectedUser.failedLogins} 次`],
                    ['账号状态', selectedUser.accountStatus],
                    ['邮箱验证', selectedUser.emailVerified ? '已验证' : '未验证'],
                    ['二次验证', '待接入'],
                  ]}
                />
              </DetailPanel>

              <DetailPanel title="操作记录" icon={<UserCog className="h-5 w-5" />}>
                <div className="space-y-4">
                  {selectedUser.notes.map((note) => (
                    <div className="border-l border-brand-600/30 pl-4" key={`${note.action}-${note.time}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{note.action}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{note.time}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note.actor}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{note.note}</p>
                    </div>
                  ))}
                </div>
              </DetailPanel>
            </div>
          </div>
        </section>

        <RoleModal user={roleUser} onClose={() => setRoleUser(null)} onConfirm={() => completeAction('角色调整已记录到审计日志')} />
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

  return (
    <>
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="User Ops"
            eyebrowIcon={<UsersRound className="h-3.5 w-3.5" />}
            title="用户管理"
            description="管理学生、审核员和管理员账号，处理准入状态、责任书、角色权限、账号安全与统一认证信息。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            type="button"
          >
            <UsersRound className="h-4 w-4" />
            导入用户
          </button>
        </div>

        {actionDone && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {actionDone}
          </div>
        )}

        <SurfacePanel className="relative z-30 mt-6 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_150px_150px_170px_220px_auto] xl:items-end">
            <SearchInput
              label="搜索用户"
              onChange={setKeyword}
              placeholder="姓名、统一认证码、邮箱、学院或手机号"
              value={keyword}
            />
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

        <div className="mt-5 grid gap-3">
          {filteredUsers.map((item) => (
            <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
                <div className="flex gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-base font-semibold text-white">
                    {item.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight">{item.name}</h2>
                      <RoleBadge role={item.role} />
                      <AccountStatusBadge status={item.accountStatus} />
                      <AccessStatusBadge status={item.accessStatus} />
                    </div>
                    <div className="mt-2 grid gap-x-5 gap-y-1 text-sm text-slate-500 sm:grid-cols-2 xl:grid-cols-4 dark:text-slate-400">
                      <p>统一认证码：{item.unifiedCode}</p>
                      <p>邮箱：{item.email}</p>
                      <p>学院 / 单位：{item.college}</p>
                      <p>注册来源：{item.source}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>提交 {item.submissions}</span>
                      <span>有效 {item.validReports}</span>
                      <span>积分 {item.points}</span>
                      <span>证书 {item.certificates}</span>
                      <span>最近登录 {item.lastLogin}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-black/5 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="grid gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <p>邮箱：{item.emailVerified ? '已验证' : '未验证'}</p>
                    <p>责任书：{item.responsibilitySigned ? '已签署' : '未签署'}</p>
                    <p>最近 IP：{item.lastIp}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-white/10">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-4 w-4" />
                  用户角色、禁用、解锁、重置密码等操作将写入审计日志
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => setRoleUser(item)}
                    type="button"
                  >
                    调整角色
                  </button>
                  <button
                    className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认重置密码？',
                        description: `将为 ${item.name} 发起密码重置流程。该操作会写入审计日志。`,
                        onConfirm: () => completeAction('密码重置已记录'),
                      })
                    }
                    type="button"
                  >
                    重置密码
                  </button>
                  <button
                    className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                    onClick={() => setSelectedId(item.id)}
                    type="button"
                  >
                    查看详情
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}

          {filteredUsers.length === 0 && (
            <SurfacePanel className="p-10 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold">没有匹配的用户</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、角色、状态或学院后再试一次。</p>
            </SurfacePanel>
          )}
        </div>
      </section>

      <RoleModal user={roleUser} onClose={() => setRoleUser(null)} onConfirm={() => completeAction('角色调整已记录到审计日志')} />
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

function RoleBadge({ role }: { role: UserRole }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${roleClassMap[role]}`}>{role}</span>
}

function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${accountStatusClassMap[status]}`}>{status}</span>
}

function AccessStatusBadge({ status }: { status: AccessStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${accessStatusClassMap[status]}`}>{status}</span>
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
      <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
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
        <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]" key={label}>
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
  user,
}: {
  onClose: () => void
  onConfirm: () => void
  user: AdminUser | null
}) {
  const [nextRole, setNextRole] = useState<UserRole>('学生')

  if (!user) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[620px] rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
              <UserCog className="h-5 w-5" />
              <span className="text-sm font-medium">Role Management</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">调整用户角色</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              当前用户为 {user.name}，现有角色是「{user.role}」。角色变更会影响菜单、权限和可访问数据范围。
            </p>
          </div>
          <button
            aria-label="关闭角色调整弹窗"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <SelectInput label="新角色" onChange={(value) => setNextRole(value as UserRole)} options={['学生', '审核员', '管理员']} value={nextRole} />
          <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
            <p>学生：提交漏洞、学习中心、积分商城、证书查看。</p>
            <p>审核员：漏洞审核、复测归档、证书建议。</p>
            <p>管理员：平台配置、用户管理、系统审计和全局运营。</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">管理员备注</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="填写角色调整原因，便于审计追踪"
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
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            type="button"
          >
            确认调整
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
