import { useEffect, useState } from 'react'
import { getPlatformLogos, subscribePlatformBranding } from '../../utils/platformBranding'

type BrandLogoProps = {
  className?: string
}

export function BrandLogo({ className = 'h-10 w-auto object-contain' }: BrandLogoProps) {
  const [logos, setLogos] = useState(() => getPlatformLogos())

  useEffect(() => subscribePlatformBranding(setLogos), [])

  return (
    <>
      <img alt="CQUPT-SRC" className={`${className} dark:hidden`} src={logos.navigationLogoUrl} />
      <img alt="CQUPT-SRC" className={`hidden ${className} dark:block`} src={logos.navigationLogoUrlDark} />
    </>
  )
}
