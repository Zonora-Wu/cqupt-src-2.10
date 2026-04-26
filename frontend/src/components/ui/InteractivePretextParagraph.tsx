import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
import { useEffect, useMemo, useRef, useState } from 'react'

type PointerPoint = {
  x: number
  y: number
}

type RenderedLine = {
  characterPositions: number[]
  text: string
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

const EFFECT_RADIUS = 76
const MAX_OFFSET = 20

export function InteractivePretextParagraph({
  className,
  locale = 'zh-CN',
  pointer: pagePointer,
  text,
}: InteractivePretextParagraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const characterRefs = useRef<Array<Array<HTMLSpanElement | null>>>([])
  const [lines, setLines] = useState<RenderedLine[]>([])
  const [lineHeight, setLineHeight] = useState(24)
  const [isEnabled, setIsEnabled] = useState(true)

  const characterOffsets = useMemo(() => {
    const pointer = getLocalPointer(containerRef.current, pagePointer)
    const container = containerRef.current
    if (!pointer || !container) return lines.map((line) => splitCharacters(line.text).map(() => zeroOffset()))

    const containerRect = container.getBoundingClientRect()
    return lines.map((line, lineIndex) => {
      const characters = splitCharacters(line.text)

      return characters.map((_, characterIndex) => {
        const node = characterRefs.current[lineIndex]?.[characterIndex]
        if (!node) {
          const fallbackX = line.characterPositions[characterIndex] ?? line.width / 2
          return getCharacterOffset(pointer, fallbackX, lineIndex * lineHeight + lineHeight / 2)
        }

        const rect = node.getBoundingClientRect()
        const centerX = rect.left - containerRect.left + rect.width / 2
        const centerY = rect.top - containerRect.top + rect.height / 2
        return getCharacterOffset(pointer, centerX, centerY)
      })
    })
  }, [lineHeight, lines, pagePointer])

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
    const element = containerRef.current
    if (!element) return

    const measure = () => {
      const styles = window.getComputedStyle(element)
      const width = element.clientWidth
      if (!width) return

      const font = [
        styles.fontStyle,
        styles.fontVariant,
        styles.fontWeight,
        styles.fontSize,
        styles.fontFamily,
      ].join(' ')
      const nextLineHeight = parseLineHeight(styles.lineHeight, styles.fontSize)
      const prepared = prepareWithSegments(text, font, {
        letterSpacing: parseFloat(styles.letterSpacing) || 0,
        whiteSpace: 'normal',
        wordBreak: locale === 'zh-CN' ? 'normal' : 'normal',
      })
      const result = layoutWithLines(prepared, width, nextLineHeight)

      setLineHeight(nextLineHeight)
      setLines(result.lines.map((line) => ({ ...getMeasuredCharacters(line.text, font), text: line.text, width: line.width })))
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [locale, text])

  if (!isEnabled) {
    return <p className={className}>{text}</p>
  }

  return (
    <div
      className={`${className} relative [text-indent:0]`}
      ref={containerRef}
      role="presentation"
    >
      {lines.length === 0 && text}
      {lines.map((line, lineIndex) => {
        const characters = splitCharacters(line.text)

        return (
          <span
            className="relative z-10 block"
            key={`${lineIndex}-${line.text}`}
            style={{
              height: lineHeight,
              marginLeft: lineIndex === 0 ? '2em' : 0,
            }}
          >
            <span aria-hidden="true" className="invisible block whitespace-pre">
              {line.text}
            </span>
            {characters.map((character, characterIndex) => {
              const offset = characterOffsets[lineIndex]?.[characterIndex] ?? zeroOffset()
              const left = line.characterPositions[characterIndex] ?? 0

              return (
                <span
                  className="absolute top-0 inline-block whitespace-pre rounded-sm will-change-transform"
                  key={`${lineIndex}-${characterIndex}-${character}`}
                  ref={(node) => {
                    characterRefs.current[lineIndex] ??= []
                    characterRefs.current[lineIndex][characterIndex] = node
                  }}
                  style={{
                    left,
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${1 + offset.force * 0.025})`,
                    transition: 'transform 70ms ease-out',
                  }}
                >
                  {character}
                </span>
              )
            })}
          </span>
        )
      })}
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
    x: (dx / distance) * MAX_OFFSET * force,
    y: (dy / distance) * MAX_OFFSET * force,
    force,
  }
}

function splitCharacters(value: string) {
  return Array.from(value)
}

function getMeasuredCharacters(value: string, font: string) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    return { characterPositions: splitCharacters(value).map((_, index) => index * 8) }
  }

  context.font = font
  const characters = splitCharacters(value)
  let measuredText = ''
  const characterPositions = characters.map((character) => {
    const left = context.measureText(measuredText).width
    measuredText += character
    return left
  })

  return { characterPositions }
}

function zeroOffset(): CharacterOffset {
  return { force: 0, x: 0, y: 0 }
}

function parseLineHeight(lineHeight: string, fontSize: string) {
  if (lineHeight === 'normal') {
    return (parseFloat(fontSize) || 16) * 1.2
  }
  return parseFloat(lineHeight) || (parseFloat(fontSize) || 16) * 1.2
}
