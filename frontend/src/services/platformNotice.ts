import type { ReactNode } from 'react'

export type PlatformNoticeVariant = 'error' | 'info' | 'success' | 'warning'

export type PlatformNoticeOptions = {
  action?: ReactNode
  autoCloseMs?: number
  onClose?: () => void
  title?: string
}

export type PlatformNoticeState = PlatformNoticeOptions & {
  id: number
  message: ReactNode
  variant: PlatformNoticeVariant
}

let currentNotice: PlatformNoticeState | null = null
let nextNoticeId = 1
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function show(message: ReactNode, variant: PlatformNoticeVariant, options: PlatformNoticeOptions = {}) {
  const normalizedMessage = typeof message === 'string' ? message.trim() : message
  if (normalizedMessage === null || normalizedMessage === undefined || normalizedMessage === false || normalizedMessage === '') return 0

  const id = nextNoticeId
  nextNoticeId += 1
  currentNotice = { id, message: normalizedMessage, variant, ...options }
  emit()
  return id
}

export const platformNotice = {
  dismiss(id?: number) {
    if (!currentNotice || (id !== undefined && currentNotice.id !== id)) return
    currentNotice = null
    emit()
  },
  error(message: ReactNode, options?: PlatformNoticeOptions) {
    return show(message, 'error', options)
  },
  info(message: ReactNode, options?: PlatformNoticeOptions) {
    return show(message, 'info', options)
  },
  success(message: ReactNode, options?: PlatformNoticeOptions) {
    return show(message, 'success', options)
  },
  warning(message: ReactNode, options?: PlatformNoticeOptions) {
    return show(message, 'warning', options)
  },
}

export function subscribePlatformNotice(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPlatformNoticeSnapshot() {
  return currentNotice
}
