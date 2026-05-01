export type CaptchaPurpose = 'LOGIN_EMAIL_CODE' | 'REGISTER_EMAIL_CODE'

export type CaptchaTrackPoint = {
  x: number
  y: number
  t: number
}

export type SliderChallenge = {
  answerHintRatio: number
  challengeId: string
  expiresIn: number
  purpose: CaptchaPurpose
}

export type SliderVerifyResponse = {
  captchaToken: string
  expiresIn: number
}

export function createSliderChallenge(purpose: CaptchaPurpose) {
  return request<SliderChallenge>('/captcha/slider/challenge', {
    body: { purpose },
    method: 'POST',
  })
}

export function verifySliderChallenge(payload: {
  challengeId: string
  offsetRatio: number
  purpose: CaptchaPurpose
  track: CaptchaTrackPoint[]
}) {
  return request<SliderVerifyResponse>('/captcha/slider/verify', {
    body: payload,
    method: 'POST',
  })
}

async function request<T>(path: string, options: { body?: unknown; method: 'POST' }) {
  return apiRequest<T>(path, options)
}
import { apiRequest } from './apiClient'
