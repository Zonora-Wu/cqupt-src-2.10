import { STATUS_STYLES, type VulnStatus } from '../../utils/vulnStatus'

interface StatusBadgeProps {
  status: VulnStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
