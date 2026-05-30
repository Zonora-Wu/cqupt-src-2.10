export type LearningResourceBody = {
  active?: unknown
  category?: unknown
  coverUrl?: unknown
  description?: unknown
  externalUrl?: unknown
  kind?: unknown
  title?: unknown
}

export type NormalizedLearningResourceInput = {
  active: boolean
  category: string
  coverUrl: string
  description: string
  externalUrl: string
  kind: 'RESOURCE' | 'RANGE'
  title: string
}
