import { SEVERITY_STYLES, type SeverityLevel } from '../../utils/severity'

interface SeverityBadgeProps {
  level: SeverityLevel
}

export function SeverityBadge({ level }: SeverityBadgeProps) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${SEVERITY_STYLES[level]}`}>
      {level}
    </span>
  )
}
