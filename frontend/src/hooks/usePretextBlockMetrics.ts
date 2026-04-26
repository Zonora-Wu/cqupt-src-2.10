import { layout, prepareWithSegments } from '@chenglou/pretext'
import { useEffect, useRef, useState } from 'react'

type PretextMetrics = {
  height: number
  lineCount: number
}

type UsePretextBlockMetricsOptions = {
  locale?: string
}

export function usePretextBlockMetrics<T extends HTMLElement>(
  text: string,
  options: UsePretextBlockMetricsOptions = {},
) {
  const ref = useRef<T | null>(null)
  const [metrics, setMetrics] = useState<PretextMetrics>({ height: 0, lineCount: 0 })

  useEffect(() => {
    const element = ref.current
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
      const lineHeight = parseLineHeight(styles.lineHeight, styles.fontSize)

      const prepared = prepareWithSegments(text, font, {
        letterSpacing: parseFloat(styles.letterSpacing) || 0,
        whiteSpace: 'normal',
        wordBreak: options.locale === 'zh-CN' ? 'normal' : 'normal',
      })
      setMetrics(layout(prepared, width, lineHeight))
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [options.locale, text])

  return { metrics, ref }
}

function parseLineHeight(lineHeight: string, fontSize: string) {
  if (lineHeight === 'normal') {
    return (parseFloat(fontSize) || 16) * 1.2
  }
  return parseFloat(lineHeight) || (parseFloat(fontSize) || 16) * 1.2
}
