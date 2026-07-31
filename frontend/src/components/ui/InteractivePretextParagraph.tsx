import { useCallback, useEffect, useRef, useState } from 'react'

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

type InteractivePretextParagraphProps = {
  className: string
  locale?: string
  subscribePointer: (subscriber: (pointer: PointerPoint | null) => void) => () => void
  text: string
}

const EFFECT_RADIUS = 86
const MAX_OFFSET = 24
const RESTING_TRANSFORM = 'translate3d(0px, 0px, 0) scale(1)'

export function InteractivePretextParagraph({
  className,
  subscribePointer,
  text,
}: InteractivePretextParagraphProps) {
  const containerRef = useRef<HTMLParagraphElement | null>(null)
  const hiddenTextRef = useRef<HTMLSpanElement | null>(null)
  const characterRefs = useRef<Array<HTMLSpanElement | null>>([])
  const transformsRef = useRef<string[]>([])
  const [characters, setCharacters] = useState<CharacterBox[]>([])
  const [isEnabled, setIsEnabled] = useState(readInteractionCapability)

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

    let measureFrame: number | null = null
    const measure = () => {
      measureFrame = null
      const textNode = hiddenText.firstChild
      if (!textNode) return

      const containerRect = container.getBoundingClientRect()
      const measuredCharacters: CharacterBox[] = []
      const range = document.createRange()

      for (let index = 0; index < text.length; index += 1) {
        range.setStart(textNode, index)
        range.setEnd(textNode, index + 1)

        const rect = range.getClientRects()[0]
        if (!rect) continue

        measuredCharacters.push({
          character: text[index],
          height: rect.height,
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
        })
      }
      range.detach()

      setCharacters((current) => sameCharacterLayout(current, measuredCharacters) ? current : measuredCharacters)
    }
    const scheduleMeasure = () => {
      if (measureFrame !== null) return
      measureFrame = window.requestAnimationFrame(measure)
    }

    measure()
    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(container)
    resizeObserver.observe(hiddenText)

    if ('fonts' in document) {
      void document.fonts.ready.then(scheduleMeasure)
    }

    return () => {
      resizeObserver.disconnect()
      if (measureFrame !== null) window.cancelAnimationFrame(measureFrame)
    }
  }, [text])

  const updateTransforms = useCallback((pagePointer: PointerPoint | null) => {
    const container = containerRef.current
    if (!container) return
    const pointer = getLocalPointer(container, pagePointer)

    if (
      !pointer
      || pointer.x < -EFFECT_RADIUS
      || pointer.y < -EFFECT_RADIUS
      || pointer.x > container.clientWidth + EFFECT_RADIUS
      || pointer.y > container.clientHeight + EFFECT_RADIUS
    ) {
      resetTransforms(characterRefs.current, transformsRef.current)
      return
    }

    characters.forEach((character, index) => {
      const element = characterRefs.current[index]
      if (!element) return
      const transform = getCharacterTransform(
        pointer,
        character.left + character.width / 2,
        character.top + character.height / 2,
      )
      if (transformsRef.current[index] === transform) return
      transformsRef.current[index] = transform
      element.style.transform = transform
    })
  }, [characters])

  useEffect(() => subscribePointer(updateTransforms), [subscribePointer, updateTransforms])

  if (!isEnabled) {
    return <p className={className}>{text}</p>
  }

  return (
    <p className={`${className} relative`} ref={containerRef}>
      <span
        aria-hidden="true"
        className="invisible block whitespace-normal [text-align-last:left] [text-indent:inherit]"
        ref={hiddenTextRef}
      >
        {text}
      </span>

      <span aria-hidden="true" className="pointer-events-none absolute inset-0 block [text-indent:0]">
        {characters.map((character, index) => {
          return (
            <span
              className="absolute inline-block whitespace-pre rounded-sm will-change-transform"
              key={`${index}-${character.character}`}
              ref={(element) => {
                characterRefs.current[index] = element
                if (element) transformsRef.current[index] = RESTING_TRANSFORM
              }}
              style={{
                left: character.left,
                top: character.top,
                transform: RESTING_TRANSFORM,
                transition: 'transform 70ms ease-out',
              }}
            >
              {character.character}
            </span>
          )
        })}
      </span>
    </p>
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

function getCharacterTransform(pointer: PointerPoint, centerX: number, centerY: number) {
  const dx = centerX - pointer.x
  const dy = centerY - pointer.y
  const distance = Math.max(Math.hypot(dx, dy), 1)

  if (distance > EFFECT_RADIUS) return RESTING_TRANSFORM

  const force = ((EFFECT_RADIUS - distance) / EFFECT_RADIUS) ** 2
  const x = (dx / distance) * MAX_OFFSET * force
  const y = (dy / distance) * MAX_OFFSET * force
  return `translate3d(${x}px, ${y}px, 0) scale(${1 + force * 0.025})`
}

function resetTransforms(elements: Array<HTMLSpanElement | null>, transforms: string[]) {
  elements.forEach((element, index) => {
    if (!element || transforms[index] === RESTING_TRANSFORM) return
    transforms[index] = RESTING_TRANSFORM
    element.style.transform = RESTING_TRANSFORM
  })
}

function sameCharacterLayout(current: CharacterBox[], next: CharacterBox[]) {
  if (current.length !== next.length) return false
  return current.every((character, index) => {
    const candidate = next[index]
    return candidate
      && character.character === candidate.character
      && character.height === candidate.height
      && character.left === candidate.left
      && character.top === candidate.top
      && character.width === candidate.width
  })
}

function readInteractionCapability() {
  return window.innerWidth >= 768 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
