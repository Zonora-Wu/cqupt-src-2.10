export type CaptchaPurpose = 'LOGIN_EMAIL_CODE' | 'REGISTER_EMAIL_CODE'

export type CaptchaTrackPoint = {
  x: number
  y: number
  t: number
}

export type CaptchaChallengeBody = {
  purpose?: unknown
}

export type CaptchaVerifyBody = {
  challengeId?: unknown
  offsetRatio?: unknown
  purpose?: unknown
  track?: unknown
}

export type NormalizedCaptchaChallengeInput = {
  purpose: CaptchaPurpose
}

export type NormalizedCaptchaVerifyInput = {
  challengeId: string
  offsetRatio: number
  purpose: CaptchaPurpose
  track: CaptchaTrackPoint[]
}
