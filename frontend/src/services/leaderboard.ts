import { apiRequest } from './apiClient'

export type LeaderboardScope = 'all' | 'month' | 'week'

export type LeaderboardEntry = {
  avatarUrl: string | null
  id: string
  isCurrent: boolean
  name: string
  rank: number | null
  reports: number
  score: number
}

export type LeaderboardResponse = {
  items: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

export function getLeaderboard(scope: LeaderboardScope = 'all') {
  return apiRequest<LeaderboardResponse>(`/leaderboard?scope=${scope}`, {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后查看排行榜',
  })
}
