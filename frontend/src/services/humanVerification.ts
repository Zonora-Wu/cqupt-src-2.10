import { API_BASE_URL, apiRequest } from './apiClient'

export type HumanVerificationPurpose =
  | 'LOGIN_PASSWORD'
  | 'LOGIN_EMAIL_CODE'
  | 'REGISTER_EMAIL_CODE'
  | 'REGISTER_SUBMIT'
  | 'RESET_PASSWORD'
  | 'CHANGE_PASSWORD'
  | 'CHANGE_EMAIL_CODE'
  | 'CHANGE_EMAIL_SUBMIT'

export type HumanVerificationPayload = {
  humanVerification: {
    payload: string
    provider: 'altcha'
  }
}

export type HumanVerificationChallengeResponse = {
  challenge: unknown
  expiresIn: number
  provider: 'altcha'
  purpose: HumanVerificationPurpose
}

export function getHumanVerificationChallengeUrl(purpose: HumanVerificationPurpose) {
  return `${API_BASE_URL}/human-verification/challenge?purpose=${encodeURIComponent(purpose)}`
}

export function createHumanVerificationPayload(payload: string): HumanVerificationPayload {
  return {
    humanVerification: {
      payload,
      provider: 'altcha',
    },
  }
}

export function fetchHumanVerificationChallenge(purpose: HumanVerificationPurpose) {
  return apiRequest<HumanVerificationChallengeResponse>('/human-verification/challenge', {
    body: { purpose },
    method: 'POST',
  })
}
