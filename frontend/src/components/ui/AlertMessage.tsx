import type { ReactNode } from 'react'
import { FloatingNotice } from './FloatingNotice'

type AlertVariant = 'error' | 'info' | 'success' | 'warning'

type AlertMessageProps = {
  action?: ReactNode
  className?: string
  message: ReactNode
  onClose?: () => void
  title?: string
  variant?: AlertVariant
}

export function AlertMessage({
  action,
  className = '',
  message,
  onClose,
  title,
  variant = 'info',
}: AlertMessageProps) {
  void className

  return (
    <FloatingNotice
      action={action}
      message={message}
      onClose={onClose}
      title={title}
      variant={variant}
    />
  )
}
