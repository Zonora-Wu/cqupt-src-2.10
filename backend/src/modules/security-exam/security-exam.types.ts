import { SecurityQuestionType } from '@prisma/client'

export type SecurityQuestionOption = {
  key: string
  text: string
}

export type NormalizedSecurityQuestionInput = {
  answerKeys: string[]
  explanation?: string
  options: SecurityQuestionOption[]
  stem: string
  type: SecurityQuestionType
}

export type SecurityExamAnswerInput = {
  questionId: string
  selectedKeys: string[]
}

export type SecurityExamQuestionView = {
  id: string
  options: SecurityQuestionOption[]
  stem: string
  type: SecurityQuestionType
}

export type SecurityQuestionAdminView = SecurityExamQuestionView & {
  active: boolean
  answerKeys: string[]
  createdAt: Date
  explanation: string | null
  source: string
  updatedAt: Date
}
