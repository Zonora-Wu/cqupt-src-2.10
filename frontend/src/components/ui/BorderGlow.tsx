import { useCallback, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

type BorderGlowProps = {
  children: ReactNode
  className?: string
  colors?: [string, string, string]
  coneSpread?: number
  contentClassName?: string
  edgeSensitivity?: number
  glowColor?: string
  glowIntensity?: number
  glowRadius?: number
}

type BorderGlowStyle = CSSProperties & Record<`--${string}`, string | number>

const gradientPositions = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const gradientKeys = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven']
const colorMap = [0, 1, 2, 0, 1, 2, 1]

export function BorderGlow({
  children,
  className = '',
  colors = ['#7fb38b', '#79aaa2', '#a7b8ae'],
  coneSpread = 25,
  contentClassName = '',
  edgeSensitivity = 30,
  glowColor = '142 34 58',
  glowIntensity = 0.72,
  glowRadius = 28,
}: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const bounds = card.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const centerX = bounds.width / 2
    const centerY = bounds.height / 2
    const deltaX = x - centerX
    const deltaY = y - centerY
    const scaleX = deltaX === 0 ? Number.POSITIVE_INFINITY : centerX / Math.abs(deltaX)
    const scaleY = deltaY === 0 ? Number.POSITIVE_INFINITY : centerY / Math.abs(deltaY)
    const edge = Math.min(Math.max(1 / Math.min(scaleX, scaleY), 0), 1)
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90
    if (angle < 0) angle += 360
    card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3))
    card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`)
  }, [])

  const style: BorderGlowStyle = {
    '--color-sensitivity': edgeSensitivity + 20,
    '--cone-spread': coneSpread,
    '--cursor-angle': '45deg',
    '--edge-proximity': 0,
    '--edge-sensitivity': edgeSensitivity,
    '--fill-opacity': 0.16,
    '--glow-padding': `${glowRadius}px`,
    ...buildGlowVariables(glowColor, glowIntensity),
    ...buildGradientVariables(colors),
  }

  return (
    <div
      className={`platform-border-glow ${className}`}
      onPointerMove={handlePointerMove}
      ref={cardRef}
      style={style}
    >
      <span aria-hidden="true" className="platform-border-glow-edge" />
      <div className={`platform-border-glow-content ${contentClassName}`}>{children}</div>
    </div>
  )
}

function buildGlowVariables(glowColor: string, intensity: number) {
  const match = glowColor.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/)
  const hue = Number.parseFloat(match?.[1] ?? '142')
  const saturation = Number.parseFloat(match?.[2] ?? '34')
  const lightness = Number.parseFloat(match?.[3] ?? '58')
  const variables: BorderGlowStyle = {}
  const opacities = [100, 60, 50, 40, 30, 20, 10]
  const suffixes = ['', '-60', '-50', '-40', '-30', '-20', '-10']
  opacities.forEach((opacity, index) => {
    variables[`--glow-color${suffixes[index]}`] = `hsl(${hue}deg ${saturation}% ${lightness}% / ${Math.min(opacity * intensity, 100)}%)`
  })
  return variables
}

function buildGradientVariables(colors: [string, string, string]) {
  const variables: BorderGlowStyle = { '--gradient-base': `linear-gradient(${colors[0]} 0 100%)` }
  gradientKeys.forEach((key, index) => {
    variables[key] = `radial-gradient(at ${gradientPositions[index]}, ${colors[colorMap[index]]} 0px, transparent 50%)`
  })
  return variables
}
