type BrandLogoProps = {
  className?: string
}

export function BrandLogo({ className = 'h-10 w-auto object-contain' }: BrandLogoProps) {
  return (
    <>
      <img alt="CQUPT-SRC" className={`${className} dark:hidden`} src="/assets/logos/CQUPT_03_logo.png" />
      <img alt="CQUPT-SRC" className={`hidden ${className} dark:block`} src="/assets/logos/CQUPT_03_logo_dark.png" />
    </>
  )
}
