import { HumanVerificationInput } from '../human-verification/human-verification.types'

export type ChangePasswordInput = {
  code: string
  humanVerification: HumanVerificationInput
  newPassword: string
}

export type ChangePasswordWithOldInput = {
  humanVerification: HumanVerificationInput
  oldPassword: string
  newPassword: string
}

export type SendChangeEmailCodeInput = {
  newEmail: string
}

export type SendCurrentEmailCodeInput = {
  humanVerification: HumanVerificationInput
  purpose: 'CHANGE_EMAIL' | 'CHANGE_PASSWORD'
}

export type ChangeEmailInput = {
  newEmail: string
  code: string
  humanVerification: HumanVerificationInput
}
