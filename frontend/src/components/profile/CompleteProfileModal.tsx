import { Badge, GraduationCap, Loader2, ShieldCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertMessage } from '../ui/AlertMessage'
import { SelectInput } from '../ui/SelectInput'
import { collegeOptions, identityTypes, isProfileBasicsComplete, teacherIdentityTypes, type ProfileBasics } from '../../constants/profile'
import { updateProfileBasics } from '../../services/account'

type CompleteProfileModalProps = {
  initialProfile?: Partial<ProfileBasics>
  onClose: () => void
  onSaved: (profile: ProfileBasics & { profileCompleted: boolean }) => void
  reason?: 'profile' | 'vulnerability'
}

export function CompleteProfileModal({
  initialProfile,
  onClose,
  onSaved,
  reason = 'profile',
}: CompleteProfileModalProps) {
  const [form, setForm] = useState<ProfileBasics>({
    college: initialProfile?.college ?? '',
    grade: initialProfile?.grade ?? '',
    identityText: initialProfile?.identityText ?? '',
    studentNo: initialProfile?.studentNo ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ text: string; type: 'error' | 'success' | 'warning' } | null>(null)
  const shouldCollectStudentNo = !teacherIdentityTypes.has(form.identityText)
  const canSave = useMemo(() => isProfileBasicsComplete(form), [form])

  const updateField = (key: keyof ProfileBasics, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'identityText' && teacherIdentityTypes.has(value) ? { studentNo: '' } : {}),
    }))
  }

  const handleSave = async () => {
    setNotice(null)
    if (!canSave) {
      setNotice({ text: '请填写学院、身份和学号信息', type: 'warning' })
      return
    }

    try {
      setSaving(true)
      const result = await updateProfileBasics(form)
      onSaved(result)
    } catch (error) {
      setNotice({ text: getErrorMessage(error), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-6">
      <button
        aria-label="关闭资料完善弹窗"
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/70"
        onClick={saving ? undefined : onClose}
        type="button"
      />
      <section className="relative w-full max-w-[520px] overflow-visible rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 text-slate-950 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:text-white">
        <button
          aria-label="关闭资料完善弹窗"
          className="absolute right-4 top-4 rounded-md p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="pr-10">
          <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">完善基础资料</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {reason === 'vulnerability' ? '提交漏洞前需要补全身份资料，用于报告归属、审核沟通和证书签发。' : '补全后可提交漏洞、参与激励和申请证书。'}
          </p>
        </header>

        <div className="mt-5 grid gap-4">
          <SelectInput
            icon={<GraduationCap />}
            label="学院 / 单位"
            onChange={(value) => updateField('college', value)}
            options={collegeOptions}
            placeholder="请选择学院 / 单位"
            value={form.college}
          />
          <SelectInput
            icon={<GraduationCap />}
            label="身份类型"
            onChange={(value) => updateField('identityText', value)}
            options={identityTypes}
            placeholder="请选择身份类型"
            value={form.identityText}
          />
          {shouldCollectStudentNo && (
            <FieldInput
              icon={<Badge />}
              label="学号"
              onChange={(value) => updateField('studentNo', value)}
              placeholder="请输入学号"
              value={form.studentNo}
            />
          )}
          <FieldInput
            icon={<GraduationCap />}
            label="年级"
            onChange={(value) => updateField('grade', value)}
            placeholder="例如 2025，可选"
            value={form.grade}
          />
        </div>

        {notice && (
          <AlertMessage
            className="mt-4"
            message={notice.text}
            onClose={() => setNotice(null)}
            variant={notice.type}
          />
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            稍后完善
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65"
            disabled={saving || !canSave}
            onClick={() => void handleSave()}
            type="button"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            保存资料
          </button>
        </div>
      </section>
    </div>
  )
}

function FieldInput({
  icon,
  label,
  onChange,
  placeholder,
  value,
}: {
  icon: ReactNode
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <span className="mt-2 flex items-center gap-3 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm transition focus-within:border-brand-600/60 focus-within:ring-1 focus-within:ring-brand-600/40 dark:border-white/10 dark:focus-within:border-brand-300/60 dark:focus-within:ring-brand-300/50">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 dark:text-white/35 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        <input
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
          maxLength={80}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="text"
          value={value}
        />
      </span>
    </label>
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return '资料保存失败，请稍后重试'
}
