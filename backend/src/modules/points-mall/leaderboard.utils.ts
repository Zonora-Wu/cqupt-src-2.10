export type LeaderboardScope = 'all' | 'month' | 'week'

export type LeaderboardCandidate = {
  avatarUrl: string | null
  achievedAt: Date
  highSeverityReports: number
  id: string
  name: string
  reports: number
  score: number
}

export type RankedLeaderboardCandidate = LeaderboardCandidate & {
  rank: number
}

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

export function getLeaderboardRangeStart(scope: LeaderboardScope, now = new Date()) {
  if (scope === 'all') return undefined

  const beijingNow = new Date(now.getTime() + BEIJING_OFFSET_MS)
  const year = beijingNow.getUTCFullYear()
  const month = beijingNow.getUTCMonth()
  const date = beijingNow.getUTCDate()
  const day = beijingNow.getUTCDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  const startDate = scope === 'week' ? date - daysToMonday : 1

  return new Date(Date.UTC(year, month, startDate) - BEIJING_OFFSET_MS)
}

export function rankLeaderboard(candidates: LeaderboardCandidate[]): RankedLeaderboardCandidate[] {
  const sorted = [...candidates].sort(
    (left, right) =>
      right.score - left.score ||
      right.reports - left.reports ||
      right.highSeverityReports - left.highSeverityReports ||
      left.achievedAt.getTime() - right.achievedAt.getTime() ||
      left.id.localeCompare(right.id),
  )

  let previousScore: number | undefined
  let previousRank = 0

  return sorted.map((candidate, index) => {
    const rank = candidate.score === previousScore ? previousRank : index + 1
    previousScore = candidate.score
    previousRank = rank
    return { ...candidate, rank }
  })
}
