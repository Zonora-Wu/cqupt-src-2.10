export type AnnouncementBody = {
  category?: unknown
  content?: unknown
  pinned?: unknown
  range?: unknown
  summary?: unknown
  title?: unknown
}

export type NormalizedAnnouncementInput = {
  category: string
  content: string
  pinned: boolean
  range: 'ALL' | 'STUDENTS' | 'AUDITORS' | 'ADMINS'
  summary: string
  title: string
}

