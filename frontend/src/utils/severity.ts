export type SeverityLevel = '严重' | '高危' | '中危' | '低危'

export const SEVERITY_STYLES: Record<SeverityLevel, string> = {
  严重: 'bg-red-600 text-white',
  高危: 'bg-orange-500 text-white',
  中危: 'bg-amber-500 text-white',
  低危: 'bg-slate-500 text-white',
}
