import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

type SpotlightCardProps = {
  children: ReactNode
  className?: string
  spotlightColor?: string
}

type SpotlightStyle = CSSProperties & {
  '--mouse-x': string
  '--mouse-y': string
  '--spotlight-color': string
}

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(255, 255, 255, 0.25)',
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const bounds = card.getBoundingClientRect()
    card.style.setProperty('--mouse-x', `${event.clientX - bounds.left}px`)
    card.style.setProperty('--mouse-y', `${event.clientY - bounds.top}px`)
  }

  const style: SpotlightStyle = {
    '--mouse-x': '50%',
    '--mouse-y': '50%',
    '--spotlight-color': spotlightColor,
  }

  return (
    <div
      className={`platform-spotlight-card ${className}`}
      onPointerMove={handlePointerMove}
      ref={cardRef}
      style={style}
    >
      {children}
    </div>
  )
}
