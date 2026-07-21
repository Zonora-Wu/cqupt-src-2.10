import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getLeaderboardRangeStart, rankLeaderboard } from '../src/modules/points-mall/leaderboard.utils'

describe('leaderboard rules', () => {
  it('uses Beijing midnight for month and Monday for week', () => {
    const now = new Date('2026-07-21T06:30:00.000Z')

    assert.equal(getLeaderboardRangeStart('month', now)?.toISOString(), '2026-06-30T16:00:00.000Z')
    assert.equal(getLeaderboardRangeStart('week', now)?.toISOString(), '2026-07-19T16:00:00.000Z')
    assert.equal(getLeaderboardRangeStart('all', now), undefined)
  })

  it('gives equal scores equal ranks while retaining deterministic display order', () => {
    const ranked = rankLeaderboard([
      candidate('a', 120, 2, 1, '2026-07-20T01:00:00.000Z'),
      candidate('b', 100, 4, 2, '2026-07-20T02:00:00.000Z'),
      candidate('c', 100, 3, 3, '2026-07-20T00:00:00.000Z'),
      candidate('d', 80, 5, 2, '2026-07-20T00:00:00.000Z'),
    ])

    assert.deepEqual(ranked.map(({ id, rank }) => ({ id, rank })), [
      { id: 'a', rank: 1 },
      { id: 'b', rank: 2 },
      { id: 'c', rank: 2 },
      { id: 'd', rank: 4 },
    ])
  })
})

function candidate(id: string, score: number, reports: number, highSeverityReports: number, achievedAt: string) {
  return {
    achievedAt: new Date(achievedAt),
    avatarUrl: null,
    highSeverityReports,
    id,
    name: id,
    reports,
    score,
  }
}
