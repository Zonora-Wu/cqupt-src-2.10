import { Eye, FileCheck2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { getAiRetestArtifact, type AiRetestJobDetail } from '../../services/aiRetests'

type Artifact = AiRetestJobDetail['artifacts'][number]

export function AiRetestEvidenceCard({ artifact, jobId }: { artifact: Artifact; jobId: string }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getAiRetestArtifact(jobId, artifact.id)
      setPreview(result.sanitizedPreview || '该证据没有可展示的脱敏文本预览。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '证据加载失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <p className="truncate text-sm font-semibold">{artifact.artifactType}</p>
          </div>
          <p className="mt-2 font-mono text-[11px] text-slate-500">SHA-256 {artifact.sha256.slice(0, 18)}… · {artifact.sizeBytes} bytes</p>
        </div>
        <button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium dark:border-white/10" disabled={loading} onClick={() => void load()} type="button">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          查看脱敏证据
        </button>
      </div>
      {preview && <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs leading-6 text-emerald-100">{preview}</pre>}
      {error && <p className="mt-3 text-xs text-red-600 dark:text-red-300">{error}</p>}
    </div>
  )
}
