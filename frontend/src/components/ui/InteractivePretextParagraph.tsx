import { useEffect, useMemo, useRef, useState } from 'react'

type PointerPoint = {
  x: number
  y: number
}

type CharacterBox = {
  character: string
  height: number
  left: number
  top: number
  width: number
}

type CharacterOffset = {
  force: number
  x: number
  y: number
}

type InteractivePretextParagraphProps = {
  className: string
  locale?: string
  pointer?: PointerPoint | null
  text: string
}

const EFFECT_RADIUS = 86
const MAX_OFFSET = 24

export function InteractivePretextParagraph({
  className,
  pointer: pagePointer,
  text,
}: InteractivePretextParagraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hiddenTextRef = useRef<HTMLParagraphElement | null>(null)
  const [characters, setCharacters] = useState<CharacterBox[]>([])
  const [isEnabled, setIsEnabled] = useState(true)

  const characterOffsets = useMemo(() => {
    const pointer = getLocalPointer(containerRef.current, pagePointer)
    if (!pointer) return characters.map(() => zeroOffset())

    return characters.map((character) => {
      const centerX = character.left + character.width / 2
      const centerY = character.top + character.height / 2
      return getCharacterOffset(pointer, centerX, centerY)
    })
  }, [characters, pagePointer])

  useEffect(() => {
    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateEnabled = () => {
      setIsEnabled(window.innerWidth >= 768 && !motionMedia.matches)
    }

    updateEnabled()
    motionMedia.addEventListener('change', updateEnabled)
    window.addEventListener('resize', updateEnabled)

    return () => {
      motionMedia.removeEventListener('change', updateEnabled)
      window.removeEventListener('resize', updateEnabled)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const hiddenText = hiddenTextRef.current
    if (!container || !hiddenText) return

    const measure = () => {
      const textNode = hiddenText.firstChild
      if (!textNode) return

      const containerRect = container.getBoundingClientRect()
      const measuredCharacters: CharacterBox[] = []

      for (let index = 0; index < text.length; index += 1) {
        const range = document.createRange()
        range.setStart(textNode, index)
        range.setEnd(textNode, index + 1)

        const rect = range.getClientRects()[0]
        range.detach()

        if (!rect) continue

        measuredCharacters.push({
          character: text[index],
          height: rect.height,
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
        })
      }

      setCharacters(measuredCharacters)
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container)
    resizeObserver.observe(hiddenText)

    if ('fonts' in document) {
      document.fonts.ready.then(measure)
    }

    return () => resizeObserver.disconnect()
  }, [text])

  if (!isEnabled) {
    return <p className={className}>{text}</p>
  }

  return (
    <div className={`${className} relative [text-indent:0]`} ref={containerRef} role="presentation">
      <p
        aria-hidden="true"
        className="invisible whitespace-normal [text-align-last:left] [text-indent:2em]"
        ref={hiddenTextRef}
      >
        {text}
      </p>

      <span aria-hidden="true" className="pointer-events-none absolute inset-0 block">
        {characters.map((character, index) => {
          const offset = characterOffsets[index] ?? zeroOffset()

          return (
            <span
              className="absolute inline-block whitespace-pre rounded-sm will-change-transform"
              key={`${index}-${character.character}`}
              style={{
                left: character.left,
                top: character.top,
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${1 + offset.force * 0.025})`,
                transition: 'transform 70ms ease-out',
              }}
            >
              {character.character}
            </span>
          )
        })}
      </span>
    </div>
  )
}

function getLocalPointer(element: HTMLElement | null, pointer: PointerPoint | null) {
  if (!element || !pointer) return null

  const rect = element.getBoundingClientRect()
  return {
    x: pointer.x - rect.left,
    y: pointer.y - rect.top,
  }
}

function getCharacterOffset(pointer: PointerPoint, centerX: number, centerY: number): CharacterOffset {
  const dx = centerX - pointer.x
  const dy = centerY - pointer.y
  const distance = Math.max(Math.hypot(dx, dy), 1)

  if (distance > EFFECT_RADIUS) return { x: 0, y: 0, force: 0 }

  const force = ((EFFECT_RADIUS - distance) / EFFECT_RADIUS) ** 2
  return {
    force,
    x: (dx / distance) * MAX_OFFSET * force,
    y: (dy / distance) * MAX_OFFSET * force,
  }
}

function zeroOffset(): CharacterOffset {
  return { force: 0, x: 0, y: 0 }
}
