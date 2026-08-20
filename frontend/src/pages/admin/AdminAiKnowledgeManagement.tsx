import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { AdminAiModelConfigurationButton } from '../../components/ai/AiModelConfigurationLauncher'
import { AdminSkillManagementPanel } from '../../components/ai/AdminSkillManagementPanel'
import { AdminSkillReviewPanel } from '../../components/ai/AdminSkillReviewPanel'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  createAiKnowledgeRevision,
  dismissAiKnowledgeMaintenanceTask,
  getAiManagementUnread,
  getAiKnowledgeStats,
  markAiManagementViewed,
  listAiKnowledge,
  listAiKnowledgeMaintenanceTasks,
  listAiKnowledgeRevisions,
  listAiProblemSessionsForReview,
  resolveAiKnowledgeMaintenanceTask,
  restoreAiKnowledgeRevision,
  reviewAiKnowledge,
  reviewAiProblemSession,
  runAiKnowledgeMaintenance,
  summarizeAiProblemSession,
  type AiKnowledgeEntry,
  type AiKnowledgeMaintenanceTask,
  type AiKnowledgeRevision,
  type AiKnowledgeStats,
  type AiKnowledgeStatus,
  type AiProblemSession,
} from '../../services/aiKnowledge'

type Workspace = 'KNOWLEDGE' | 'SKILLS' | 'SKILL_REVIEW'
type KnowledgeTab = 'REVIEW' | 'ENTRIES' | 'AUTO_APPROVED' | 'MAINTENANCE'

const statusLabel: Record<string, string> = {
  APPROVED: '已批准', APPROVED_TO_KB: '已入库', ARCHIVED: '已归档', AUTO_APPROVED: '自动入库',
  DISCARDED: '已丢弃', NEEDS_REVIEW: '待审核', OPEN: '待处理', READY_REVIEW: '待沉淀审核',
  REJECTED: '已拒绝', RESOLVED: '已解决', SECURITY_SUSPENDED: '安全暂停',
}

const categoryOptions = ['VULNERABILITY_REPORTING', 'XSS', 'SQL_INJECTION', 'SSRF', 'FILE_UPLOAD', 'ACCESS_CONTROL', 'AUTHENTICATION', 'SECURITY_LEARNING', 'SRC_RULES', 'PLATFORM_USAGE', 'AUDITOR_REVIEW', 'ADMIN_ANALYTICS']
const inputClass = 'w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-600 dark:border-white/10 dark:text-slate-100'

export function AdminAiKnowledgeManagement({ onViewed }: { onViewed?: () => void }) {
  const [workspace, setWorkspace] = useState<Workspace>('KNOWLEDGE')
  const [tab, setTab] = useState<KnowledgeTab>('REVIEW')
  const [entries, setEntries] = useState<AiKnowledgeEntry[]>([])
  const [sessions, setSessions] = useState<AiProblemSession[]>([])
  const [tasks, setTasks] = useState<AiKnowledgeMaintenanceTask[]>([])
  const [stats, setStats] = useState<AiKnowledgeStats | null>(null)
  const [selected, setSelected] = useState<AiKnowledgeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status: AiKnowledgeStatus | undefined = tab === 'AUTO_APPROVED' ? 'AUTO_APPROVED' : undefined
      const [nextStats, knowledge, reviewQueue, maintenance, unread] = await Promise.all([
        getAiKnowledgeStats(),
        listAiKnowledge({ page: 1, pageSize: 50, status }),
        listAiProblemSessionsForReview({ page: 1, pageSize: 30 }),
        listAiKnowledgeMaintenanceTasks({ page: 1, pageSize: 50, status: 'OPEN' }),
        getAiManagementUnread(),
      ])
      setStats(nextStats); setEntries(knowledge.items); setSessions(reviewQueue.items); setTasks(maintenance.items)
      await markAiManagementViewed(unread.viewedThrough)
      onViewed?.()
    } catch (error) {
      setNotice({ error: true, message: error instanceof Error ? error.message : 'AI 知识数据加载失败' })
    } finally { setLoading(false) }
  }, [onViewed, tab])

  useEffect(() => { void load() }, [load])

  async function act(key: string, task: () => Promise<unknown>, success: string) {
    setBusy(key)
    try { await task(); setNotice({ message: success }); await load() }
    catch (error) { setNotice({ error: true, message: error instanceof Error ? error.message : '操作失败' }) }
    finally { setBusy('') }
  }

  return <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <PageHeader title="AI 管理" description="平台模型、独立 Skill 与可复用对话知识分别治理。" />
      <div className="flex flex-wrap gap-2">
        <AdminAiModelConfigurationButton trigger={(open) => <Button onClick={open}>配置平台模型</Button>} />
        <Button onClick={() => void load()}>刷新</Button>
        {workspace === 'KNOWLEDGE' && tab === 'MAINTENANCE' ? <Button primary disabled={busy === 'scan'} onClick={() => void act('scan', runAiKnowledgeMaintenance, '维护扫描完成')}>运行维护扫描</Button> : null}
      </div>
    </div>

    {notice ? <FloatingNotice message={notice.message} onClose={() => setNotice(null)} variant={notice.error ? 'error' : 'success'} /> : null}

    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="审核积压" value={stats?.totals.reviewBacklog ?? 0} />
      <Stat label="已批准知识" value={stats?.totals.approved ?? 0} />
      <Stat label="24 小时检索" value={stats?.totals.recentHits ?? 0} />
      <Stat label="30 天直接回答" value={stats?.totals.directAnswers ?? 0} />
      <Stat label="估算节省 Token" value={stats?.totals.estimatedTokensSaved ?? 0} />
    </div>

    <div className="mt-6 flex border-b border-black/10 dark:border-white/10">
      <Tab active={workspace === 'KNOWLEDGE'} onClick={() => setWorkspace('KNOWLEDGE')}>知识审核</Tab>
      <Tab active={workspace === 'SKILLS'} onClick={() => setWorkspace('SKILLS')}>Skill 管理</Tab>
      <Tab active={workspace === 'SKILL_REVIEW'} onClick={() => setWorkspace('SKILL_REVIEW')}>Skill 审核</Tab>
    </div>

    {workspace === 'SKILLS' ? <div className="mt-6"><AdminSkillManagementPanel /></div> : null}
    {workspace === 'SKILL_REVIEW' ? <div className="mt-6"><AdminSkillReviewPanel /></div> : null}
    {workspace === 'KNOWLEDGE' ? <>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <Pill active={tab === 'REVIEW'} onClick={() => setTab('REVIEW')}>待审核会话</Pill>
        <Pill active={tab === 'ENTRIES'} onClick={() => setTab('ENTRIES')}>知识条目</Pill>
        <Pill active={tab === 'AUTO_APPROVED'} onClick={() => setTab('AUTO_APPROVED')}>自动入库</Pill>
        <Pill active={tab === 'MAINTENANCE'} onClick={() => setTab('MAINTENANCE')}>维护任务</Pill>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? <Empty>正在加载...</Empty> : null}
        {!loading && tab === 'REVIEW' && sessions.length === 0 ? <Empty>暂无待审核问题会话。</Empty> : null}
        {tab === 'REVIEW' ? sessions.map((session) => <SessionRow key={session.id} session={session} busy={busy === session.id} onAction={(fn, text) => void act(session.id, fn, text)} />) : null}
        {(tab === 'ENTRIES' || tab === 'AUTO_APPROVED') && !loading && entries.length === 0 ? <Empty>当前筛选条件下暂无知识条目。</Empty> : null}
        {tab === 'ENTRIES' || tab === 'AUTO_APPROVED' ? entries.map((entry) => <KnowledgeRow key={entry.id} entry={entry} busy={busy === entry.id} onEdit={() => setSelected(entry)} onAction={(fn, text) => void act(entry.id, fn, text)} />) : null}
        {tab === 'MAINTENANCE' && !loading && tasks.length === 0 ? <Empty>当前没有待处理维护任务。</Empty> : null}
        {tab === 'MAINTENANCE' ? tasks.map((task) => <MaintenanceRow key={task.id} task={task} busy={busy === task.id} onAction={(fn, text) => void act(task.id, fn, text)} />) : null}
      </div>
    </> : null}

    {selected ? <KnowledgeEditor entry={selected} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await load(); setNotice({ message: '知识修订已保存' }) }} /> : null}
  </section>
}

function SessionRow({ session, busy, onAction }: { session: AiProblemSession; busy: boolean; onAction: (fn: () => Promise<unknown>, text: string) => void }) {
  const summary = session.summaryJson
  return <SurfacePanel className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
    <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><Badge>{statusLabel[session.status] ?? session.status}</Badge><Badge>{session.turnCount} 条消息</Badge>{summary ? <Badge>建议 {summary.recommendation === 'KB' ? '入库' : '丢弃'}</Badge> : null}</div>
      <h3 className="mt-3 font-semibold">{session.title || session.initialQuestion}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{summary?.resolution || session.initialQuestion}</p>
      {summary ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">质量 {pct(summary.scores.quality)} · 复用 {pct(summary.scores.reuse)} · 安全 {pct(summary.scores.safety)} · 隐私风险 {pct(summary.scores.privacy)} · 置信 {pct(summary.scores.confidence)}</p> : null}
    </div>
    <div className="flex shrink-0 flex-wrap gap-2 lg:w-36 lg:flex-col"><Button disabled={busy} onClick={() => onAction(() => summarizeAiProblemSession(session.id), '会话总结已更新')}>重新总结</Button><Button primary disabled={busy || summary?.recommendation === 'DISCARD'} onClick={() => onAction(() => reviewAiProblemSession(session.id, 'APPROVED_TO_KB', '管理员批准入库'), '会话已进入知识库')}>批准入库</Button><Button danger disabled={busy} onClick={() => onAction(() => reviewAiProblemSession(session.id, 'DISCARDED', '不具备复用价值'), '会话已丢弃')}>丢弃</Button></div>
  </div></SurfacePanel>
}

function KnowledgeRow({ entry, busy, onEdit, onAction }: { entry: AiKnowledgeEntry; busy: boolean; onEdit: () => void; onAction: (fn: () => Promise<unknown>, text: string) => void }) {
  return <SurfacePanel className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div className="min-w-0 flex-1">
    <div className="flex flex-wrap gap-2"><Badge>{statusLabel[entry.status] ?? entry.status}</Badge><Badge>{entry.category}</Badge><Badge>{statusLabel[entry.maintenanceStatus] ?? entry.maintenanceStatus}</Badge></div>
    <h3 className="mt-3 font-semibold">{entry.title}</h3><p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{entry.canonicalQuestion}</p>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">来源 {entry.source} · 会话 {entry.sourceSessionIds.length} · 质量 {pct(entry.answerQualityScore)} · 复用 {pct(entry.reuseValueScore)} · 安全 {pct(entry.safetyScore)} · 置信 {pct(entry.confidenceScore)}</p>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">命中 {entry.hitCount} · 有用 {entry.helpfulCount} · 无用 {entry.unhelpfulCount} · 举报 {entry.abuseReportCount} · 检索 {entry.retrievalEnabled ? '开' : '关'} · 直接回答 {entry.directAnswerEnabled ? '开' : '关'} · 上下文注入 {entry.agentInjectEnabled ? '开' : '关'}</p>
  </div><div className="flex shrink-0 flex-wrap gap-2 lg:w-32 lg:flex-col"><Button onClick={onEdit}>查看 / 编辑</Button>{entry.status === 'NEEDS_REVIEW' ? <><Button primary disabled={busy} onClick={() => onAction(() => reviewAiKnowledge(entry.id, 'APPROVED', '管理员审核通过'), '知识已批准')}>批准</Button><Button danger disabled={busy} onClick={() => onAction(() => reviewAiKnowledge(entry.id, 'REJECTED', '不符合入库标准'), '知识已拒绝')}>拒绝</Button></> : null}{entry.status !== 'ARCHIVED' ? <Button disabled={busy} onClick={() => onAction(() => reviewAiKnowledge(entry.id, 'ARCHIVED', '管理员归档'), '知识已归档')}>归档</Button> : null}</div>
  </div></SurfacePanel>
}

function MaintenanceRow({ task, busy, onAction }: { task: AiKnowledgeMaintenanceTask; busy: boolean; onAction: (fn: () => Promise<unknown>, text: string) => void }) {
  return <SurfacePanel className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div><div className="flex gap-2"><Badge>{task.priority}</Badge><Badge>{task.taskType}</Badge></div><h3 className="mt-3 font-semibold">{task.knowledge?.title || task.knowledgeId}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{task.reason}</p></div><div className="flex gap-2 lg:w-32 lg:flex-col"><Button primary disabled={busy} onClick={() => onAction(() => resolveAiKnowledgeMaintenanceTask(task.id, '管理员确认完成维护'), '维护任务已解决')}>解决</Button><Button disabled={busy} onClick={() => onAction(() => dismissAiKnowledgeMaintenanceTask(task.id, '管理员确认忽略'), '维护任务已忽略')}>忽略</Button></div></div></SurfacePanel>
}

function KnowledgeEditor({ entry, onClose, onSaved }: { entry: AiKnowledgeEntry; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(entry)
  const [reason, setReason] = useState('')
  const [revisions, setRevisions] = useState<AiKnowledgeRevision[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { listAiKnowledgeRevisions(entry.id).then(setRevisions).catch((e: unknown) => setError(e instanceof Error ? e.message : '版本加载失败')) }, [entry.id])
  const set = <K extends keyof AiKnowledgeEntry>(key: K, value: AiKnowledgeEntry[K]) => setForm((current) => ({ ...current, [key]: value }))
  async function save() { if (reason.trim().length < 3) { setError('请填写至少 3 个字符的修订原因'); return } setBusy(true); setError(''); try { await createAiKnowledgeRevision(entry.id, { agentInjectEnabled: form.agentInjectEnabled, canonicalAnswer: form.canonicalAnswer, canonicalQuestion: form.canonicalQuestion, category: form.category, changeReason: reason, directAnswerEnabled: form.directAnswerEnabled, retrievalEnabled: form.retrievalEnabled, roleScope: form.roleScope, sensitivity: form.sensitivity, tags: form.tags, title: form.title, visibility: form.visibility }); await onSaved() } catch (e) { setError(e instanceof Error ? e.message : '保存失败') } finally { setBusy(false) } }
  async function restore(revision: AiKnowledgeRevision) { const rollbackReason = window.prompt(`回滚到 v${revision.version}，请输入原因：`)?.trim(); if (!rollbackReason) return; setBusy(true); try { await restoreAiKnowledgeRevision(entry.id, revision.id, rollbackReason); await onSaved() } catch (e) { setError(e instanceof Error ? e.message : '回滚失败') } finally { setBusy(false) } }
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div aria-modal="true" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-5 shadow-2xl dark:border-white/10" role="dialog">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">知识详情与修订</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">每次保存生成不可变版本，回滚同样写入审计。</p></div><button aria-label="关闭" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="h-5 w-5" /></button></div>
    {error ? <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">{error}</p> : null}
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-4"><Field label="标题"><input autoComplete="off" className={inputClass} maxLength={120} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field><Field label="标准问题"><textarea className={`${inputClass} min-h-24`} maxLength={3000} value={form.canonicalQuestion} onChange={(e) => set('canonicalQuestion', e.target.value)} /></Field><Field label="标准答案"><textarea className={`${inputClass} min-h-56`} maxLength={12000} value={form.canonicalAnswer} onChange={(e) => set('canonicalAnswer', e.target.value)} /></Field><Field label="标签（逗号分隔）"><input autoComplete="off" className={inputClass} maxLength={1000} value={form.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(/[,，]/).map((v) => v.trim()).filter(Boolean))} /></Field><Field label="修订原因（必填）"><textarea className={`${inputClass} min-h-20`} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
      <aside className="space-y-4"><SelectInput label="分类" options={categoryOptions} value={form.category} onChange={(v) => set('category', v as AiKnowledgeEntry['category'])} /><SelectInput label="角色范围" options={['ALL', 'STUDENT', 'AUDITOR', 'ADMIN']} value={form.roleScope} onChange={(v) => set('roleScope', v as AiKnowledgeEntry['roleScope'])} /><SelectInput label="敏感级别" options={['PUBLIC', 'INTERNAL', 'SENSITIVE', 'REJECTED']} value={form.sensitivity} onChange={(v) => set('sensitivity', v as AiKnowledgeEntry['sensitivity'])} /><SelectInput label="可见范围" options={['PLATFORM_PUBLIC', 'ROLE_ONLY', 'REVIEW_REQUIRED', 'PRIVATE']} value={form.visibility} onChange={(v) => set('visibility', v as AiKnowledgeEntry['visibility'])} />
        <div className="space-y-2 border-y border-black/10 py-3 dark:border-white/10"><Switch label="参与检索" checked={form.retrievalEnabled} onChange={(v) => { set('retrievalEnabled', v); if (!v) { set('directAnswerEnabled', false); set('agentInjectEnabled', false) } }} /><Switch label="高置信直接回答" checked={form.directAnswerEnabled} disabled={!form.retrievalEnabled} onChange={(v) => set('directAnswerEnabled', v)} /><Switch label="中置信上下文注入" checked={form.agentInjectEnabled} disabled={!form.retrievalEnabled} onChange={(v) => set('agentInjectEnabled', v)} /></div>
        <div><h3 className="text-sm font-semibold">版本记录</h3><div className="mt-2 max-h-56 space-y-2 overflow-y-auto">{revisions.map((revision) => <div className="border-b border-black/10 pb-2 text-xs dark:border-white/10" key={revision.id}><div className="flex justify-between gap-2"><b>v{revision.version} · {revision.changeType}</b><button className="text-brand-700 disabled:opacity-50 dark:text-brand-200" disabled={busy} onClick={() => void restore(revision)} type="button">回滚</button></div><p className="mt-1 text-slate-500 dark:text-slate-400">{revision.changeReason}</p></div>)}</div></div>
      </aside></div><div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>取消</Button><Button primary disabled={busy} onClick={() => void save()}>{busy ? '保存中...' : '保存修订'}</Button></div>
  </div></div>
}

function Button({ children, danger, primary, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; primary?: boolean }) { return <button {...props} className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${primary ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700' : danger ? 'border-red-500/25 text-red-700 hover:bg-red-500/10 dark:text-red-200' : 'border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'}`} type="button">{children}</button> }
function Tab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button className={`border-b-2 px-4 py-3 text-sm font-semibold ${active ? 'border-brand-600 text-brand-800 dark:text-brand-200' : 'border-transparent text-slate-500 dark:text-slate-400'}`} onClick={onClick} type="button">{children}</button> }
function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${active ? 'border-brand-600/30 bg-brand-600/10 text-brand-800 dark:text-brand-200' : 'border-black/10 text-slate-500 dark:border-white/10 dark:text-slate-400'}`} onClick={onClick} type="button">{children}</button> }
function Stat({ label, value }: { label: string; value: number }) { return <SurfacePanel className="p-4"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold">{new Intl.NumberFormat('zh-CN').format(value)}</p></SurfacePanel> }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-lg border border-black/10 px-2.5 py-1 text-xs dark:border-white/10">{children}</span> }
function Empty({ children }: { children: React.ReactNode }) { return <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{children}</SurfacePanel> }
function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label> }
function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (value: boolean) => void }) { return <label className={`flex items-center justify-between gap-3 text-sm ${disabled ? 'opacity-45' : ''}`}><span>{label}</span><input checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} type="checkbox" /></label> }
function pct(value: number) { return `${Math.round((value || 0) * 100)}%` }
