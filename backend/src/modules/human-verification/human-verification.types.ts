export type HumanVerificationPurpose =
  | 'LOGIN_PASSWORD'
  | 'LOGIN_EMAIL_CODE'
  | 'REGISTER_EMAIL_CODE'
  | 'REGISTER_SUBMIT'
  | 'CHANGE_PASSWORD'
  | 'CHANGE_EMAIL_CODE'
  | 'CHANGE_EMAIL_SUBMIT'

export type HumanVerificationProvider = 'altcha'

export type HumanVerificationInput = {
  payload: string
  provider: HumanVerificationProvider
}

export type HumanVerificationChallengeResponse = {
  challenge: unknown
  expiresIn: number
  provider: HumanVerificationProvider
  purpose: HumanVerificationPurpose
}
