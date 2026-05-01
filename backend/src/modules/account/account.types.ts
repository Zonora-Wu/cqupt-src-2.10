export type ChangePasswordInput = {
  oldPassword: string
  newPassword: string
}

export type SendChangeEmailCodeInput = {
  newEmail: string
}

export type ChangeEmailInput = {
  newEmail: string
  code: string
}
