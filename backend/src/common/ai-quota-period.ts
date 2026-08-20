export type AiQuotaPeriod = 'DAY' | 'WEEK' | 'MONTH'

type TokenLimits = { daily: number; monthly: number; weekly: number }

export function getActiveTokenLimit(limits: TokenLimits, period: AiQuotaPeriod) {
  if (period === 'DAY') return limits.daily
  if (period === 'WEEK') return limits.weekly
  return limits.monthly
}

export function getQuotaPeriodStart(period: AiQuotaPeriod, now = new Date()) {
  if (period === 'DAY') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'WEEK') {
    const day = now.getDay() || 7
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function getNextQuotaPeriodStart(period: AiQuotaPeriod, now = new Date()) {
  const start = getQuotaPeriodStart(period, now)
  if (period === 'DAY') return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  if (period === 'WEEK') return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  return new Date(start.getFullYear(), start.getMonth() + 1, 1)
}

export function normalizeStoredTokenLimit(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : fallback
}

export function normalizeQuotaPeriod(value: unknown): AiQuotaPeriod {
  return value === 'DAY' || value === 'WEEK' || value === 'MONTH' ? value : 'MONTH'
}
