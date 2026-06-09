import { apiFormRequest, apiRequest } from './apiClient'

export type SecurityQuestionType = 'SINGLE_CHOICE' | 'TRUE_FALSE' | 'MULTIPLE_CHOICE'

export type SecurityQuestionOption = {
  key: string
  text: string
}

export type SecurityExamQuestion = {
  id: string
  options: SecurityQuestionOption[]
  stem: string
  type: SecurityQuestionType
}

export type SecurityExamPaper = {
  questions: SecurityExamQuestion[]
  threshold: number
  totalScore: number
}

export type SecurityExamSubmitResult = {
  correctCount: number
  passed: boolean
  questionCount: number
  score: number
  submittedAt: string
  threshold: number
}

export type SecurityQuestionAdmin = SecurityExamQuestion & {
  active: boolean
  answerKeys: string[]
  createdAt: string
  explanation: string | null
  source: string
  updatedAt: string
}

export type SecurityExamSettings = {
  activeCounts: Record<string, number>
  enabled: boolean
  requiredCounts: Record<SecurityQuestionType, number>
  threshold: number
  totalScore: number
}

export function getSecurityExamPaper() {
  return apiRequest<SecurityExamPaper>('/security-exam/paper', { auth: true, method: 'GET', unauthenticatedMessage: '请先登录后再答题' })
}

export function submitSecurityExamAnswers(answers: Array<{ questionId: string; selectedKeys: string[] }>) {
  return apiRequest<SecurityExamSubmitResult>('/security-exam/submit', { auth: true, body: { answers }, method: 'POST', unauthenticatedMessage: '请先登录后再提交答题' })
}

export function getSecurityExamSettings() {
  return adminRequest<SecurityExamSettings>('/system-settings/security-exam/settings', { method: 'GET' })
}

export function updateSecurityExamSettings(data: { enabled: boolean; threshold: number }) {
  return adminRequest<SecurityExamSettings>('/system-settings/security-exam/settings', { body: data, method: 'POST' })
}

export function listSecurityQuestions() {
  return adminRequest<SecurityQuestionAdmin[]>('/system-settings/security-exam/questions', { method: 'GET' })
}

export function createSecurityQuestions(questions: unknown[]) {
  return adminRequest<{ count: number; questions: SecurityQuestionAdmin[] }>('/system-settings/security-exam/questions', { body: { questions }, method: 'POST' })
}

export function setSecurityQuestionActive(id: string, active: boolean) {
  return adminRequest<SecurityQuestionAdmin>(`/system-settings/security-exam/questions/${id}/active`, { body: { active }, method: 'POST' })
}

export function generateSecurityQuestionsWithAi(data: { difficulty: string; topic: string }) {
  return adminRequest<{ count: number; questions: SecurityQuestionAdmin[] }>('/system-settings/security-exam/ai-generate', { body: data, method: 'POST' })
}

export function importSecurityQuestionsFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiFormRequest<{ count: number; questions: SecurityQuestionAdmin[] }>('/system-settings/security-exam/import', { auth: true, formData, unauthenticatedMessage: '请先登录后再管理题库' })
}

function adminRequest<T>(path: string, options: { body?: unknown; method: 'GET' | 'POST' }) {
  return apiRequest<T>(path, { ...options, auth: true, unauthenticatedMessage: '请先登录后再管理题库' })
}
