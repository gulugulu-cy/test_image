import { NextResponse, NextRequest } from 'next/server'
import acceptLanguage from 'accept-language'
import {
  fallbackLng,
  languages,
  cookieName,
  searchParamName,
} from './app/i18n/settings'
import { logger } from './lib/logger'

acceptLanguage.languages(languages)

export const config = {
  // matcher: '/:lng*'
  matcher: [
    '/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js|site.webmanifest).*)',
  ],
}

export function middleware(req: NextRequest) {
  // 标题栏图标、chrome查看网页图标、网站图标、网站清单等请求，直接跳过
  if (
    req.nextUrl.pathname.indexOf('icon') > -1 ||
    req.nextUrl.pathname.indexOf('chrome') > -1
  )
    return NextResponse.next()
  let lng: string | undefined | null
  let searchLng: string | undefined | null = undefined
  let pathLng: string | undefined | null = undefined
  let headerLng: string | undefined | null = undefined
  // 1 从查询参数中获取语言
  if (req.nextUrl.searchParams.has(searchParamName))
    searchLng = acceptLanguage.get(
      req.nextUrl.searchParams.get(searchParamName)
    )
  // 2 从cookie中获取语言
  if (req.cookies.has(cookieName))
    lng = acceptLanguage.get(req.cookies.get(cookieName)?.value)
  // 3 从请求头中获取语言
  if (!lng)
    lng = headerLng = acceptLanguage.get(req.headers.get('Accept-Language'))
  // 4 默认语言
  if (!lng) lng = fallbackLng

  // 查询参数存在即删除
  searchLng && req.nextUrl.searchParams.delete(searchParamName)

  // 获取路径中的语言
  pathLng = languages.find((loc) => req.nextUrl.pathname.startsWith(`/${loc}`))

  // 如果查询参数中存在语言，则重定向到以语言为前缀的路径
  // 如果查询参数不存在，并且路径不是以语言为前缀的路径，则重定向到以语言为前缀的路径
  if (
    // 1 不存在以查询参数为前缀的路径
    ((searchLng && !req.nextUrl.pathname.startsWith(`/${searchLng}`)) ||
      // 2 不存在以语言为前缀的路径
      !pathLng) &&
    // 不是以_next为前缀的路径
    !req.nextUrl.pathname.startsWith('/_next')
  ) {
    logger.debug({ searchLng, pathLng, lng })
    searchLng &&
      ((lng = searchLng),
      (req.nextUrl.pathname =
        req.nextUrl.pathname.replace(`/${pathLng}`, '') || '/'))
    return NextResponse.redirect(
      new URL(`/${lng}${req.nextUrl.pathname}`, req.url),
      {
        headers: {
          'Set-Cookie': `${cookieName}=${lng}; path=/; Max-Age=2147483647`,
        },
      }
    )
  }

  if (req.headers.has('referer')) {
    const refererUrl = new URL(req.headers.get('referer') || '')
    const lngInReferer = languages.find((l) =>
      refererUrl.pathname.startsWith(`/${l}`)
    )
    const response = NextResponse.next()
    if (lngInReferer) response.cookies.set(cookieName, lngInReferer)
    return response
  }

  return NextResponse.next()
}
