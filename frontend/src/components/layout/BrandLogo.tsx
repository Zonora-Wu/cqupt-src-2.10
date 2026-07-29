import { useEffect, useState } from 'react'
import { getPlatformLogos, subscribePlatformBranding } from '../../utils/platformBranding'

type BrandLogoProps = {
  className?: string
  onDarkSurface?: boolean
}

export function BrandLogo({ className = 'h-10 w-auto object-contain', onDarkSurface = false }: BrandLogoProps) {
  const [logos, setLogos] = useState(() => getPlatformLogos())

  useEffect(() => subscribePlatformBranding(setLogos), [])

  if (onDarkSurface) {
    return <img alt="CQUPT-SRC" className={className} src={logos.navigationLogoUrlDark} />
  }

  return (
    <>
      <img alt="CQUPT-SRC" className={`${className} dark:hidden`} src={logos.navigationLogoUrl} />
      <img alt="CQUPT-SRC" className={`hidden ${className} dark:block`} src={logos.navigationLogoUrlDark} />
    </>
  )
}
