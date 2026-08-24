import { useEffect, useRef, type ReactNode } from 'react'
import { platformNotice } from '../../services/platformNotice'

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
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const id = platformNotice[variant](message, {
      action,
      onClose: () => onCloseRef.current?.(),
      title,
    })
    return () => platformNotice.dismiss(id)
  }, [action, message, title, variant])

  return null
}
