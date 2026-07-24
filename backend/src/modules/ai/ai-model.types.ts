import { AiModelPurpose, AiModelSource, AiUserModelPolicy } from '@prisma/client'

export const AI_PROVIDER_CONSENT_VERSION = '2026-07-23'

export type AiResolvedModel = {
  apiKey: string
  baseUrl: string
  credentialId?: string
  model: string
  providerId: string
  source: AiModelSource
  routeId?: string
}

export type PlatformAiRouteInput = {
  apiKey?: unknown
  automaticFailover?: unknown
  baseUrl?: unknown
  model?: unknown
  name?: unknown
  priority?: unknown
  providerId?: unknown
  purpose?: unknown
}

export type PlatformAiConfigResponse = {
  routes: Array<{
    automaticFailover: boolean
    baseUrl: string
    circuitOpenUntil: Date | null
    credentialLastFour: string
    credentialName: string
    id: string
    model: string
    priority: number
    providerId: string
    purpose: AiModelPurpose
  }>
}

export type AiModelPolicyResponse = {
  userMode: AiUserModelPolicy
  updatedAt: Date | null
}

export type CreateUserCredentialInput = {
  apiKey?: unknown
  baseUrl?: unknown
  consentAccepted?: unknown
  name?: unknown
  providerId?: unknown
}

export type CreateUserModelInput = {
  credentialId?: unknown
  displayName?: unknown
  isDefault?: unknown
  model?: unknown
}
