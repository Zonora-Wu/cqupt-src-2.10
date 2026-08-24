import { useSyncExternalStore } from 'react'
import {
  getPlatformNoticeSnapshot,
  platformNotice,
  subscribePlatformNotice,
} from '../../services/platformNotice'
import { FloatingNotice } from './FloatingNotice'

export function PlatformNoticeCenter() {
  const notice = useSyncExternalStore(
    subscribePlatformNotice,
    getPlatformNoticeSnapshot,
    getPlatformNoticeSnapshot,
  )

  if (!notice) return null

  return (
    <FloatingNotice
      action={notice.action}
      autoCloseMs={notice.autoCloseMs}
      message={notice.message}
      onClose={() => {
        notice.onClose?.()
        platformNotice.dismiss(notice.id)
      }}
      title={notice.title}
      variant={notice.variant}
    />
  )
}
