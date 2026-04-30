export type LearningResourceBody = {
  active?: unknown
  category?: unknown
  description?: unknown
  externalUrl?: unknown
  kind?: unknown
  title?: unknown
}

export type NormalizedLearningResourceInput = {
  active: boolean
  category: string
  description: string
  externalUrl: string
  kind: 'RESOURCE' | 'RANGE'
  title: string
}

