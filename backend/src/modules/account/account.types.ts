export type ChangePasswordInput = {
  code: string
  newPassword: string
}

export type SendChangeEmailCodeInput = {
  newEmail: string
}

export type SendCurrentEmailCodeInput = {
  purpose: 'CHANGE_EMAIL' | 'CHANGE_PASSWORD'
}

export type ChangeEmailInput = {
  newEmail: string
  code: string
}
