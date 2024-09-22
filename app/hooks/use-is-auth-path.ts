import { env } from 'next-runtime-env'
import { useParams, usePathname } from 'next/navigation'
import { useMemo } from 'react'

function useIsAuthPath() {
  const { locale } = useParams()
  const pathname = usePathname()

  const isAuthPage = useMemo(
    () => pathname === `/${locale}/auth`,
    [pathname, locale]
  )

  return { isAuthPage }
}

export { useIsAuthPath }
