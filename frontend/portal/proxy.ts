// Next 16 renamed `middleware.ts` → `proxy.ts`. This file merges two
// concerns that used to live separately:
//
//   1. Content-Security-Policy + related security headers on every
//      response (was middleware.ts before Next 16). REPORT-ONLY until
//      violations from real traffic are triaged.
//
//   2. Content negotiation for AI answer engines: if a client sends
//      `Accept: text/markdown` on a marketing-content URL, rewrite
//      to the `/md/*` route. Standards-compliant — same URL, two
//      formats. HTML stays canonical for humans.

import { NextRequest, NextResponse } from 'next/server'

// ── CSP (was middleware.ts) ─────────────────────────────────────────

const REPORT_ONLY = process.env.CSP_REPORT_ONLY !== 'false'

const API_HOST = process.env.NEXT_PUBLIC_API_URL || 'https://assessexpert.com'
const API_ORIGIN = (() => {
  try { return new URL(API_HOST).origin } catch { return 'https://assessexpert.com' }
})()

function buildCsp(): string {
  const directives: string[] = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `img-src 'self' data: blob: ${API_ORIGIN}`,
    `connect-src 'self' ${API_ORIGIN} wss: ws:`,
    `media-src 'self' blob: data:`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ]
  return directives.join('; ')
}

const CSP_VALUE = buildCsp()
const CSP_HEADER = REPORT_ONLY
  ? 'Content-Security-Policy-Report-Only'
  : 'Content-Security-Policy'

const CSP_SKIP_PREFIXES = ['/_next', '/api', '/blog-cover', '/favicon', '/sitemap', '/robots']

function applySecurityHeaders(res: NextResponse) {
  res.headers.set(CSP_HEADER, CSP_VALUE)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')
}

// ── Content negotiation ─────────────────────────────────────────────

function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false
  const a = accept.toLowerCase()
  if (a.includes('text/markdown')) return true
  // text/plain with no explicit text/html preference — treat as
  // "give me the source form".
  if (a.includes('text/plain') && !a.includes('text/html')) return true
  return false
}

function markdownTwin(pathname: string): string | null {
  if (pathname === '/') return '/md/pages/home'
  if (pathname === '/about') return '/md/pages/about'
  if (pathname === '/services') return '/md/pages/services'
  if (pathname === '/contact') return '/md/pages/contact'
  if (pathname === '/blog') return '/md/pages/blog'
  const svc = pathname.match(/^\/services\/([^/]+)\/?$/)
  if (svc) return `/md/services/${svc[1]}`
  const post = pathname.match(/^\/blog\/([^/]+)\/?$/)
  if (post) return `/md/blog/${post[1]}`
  return null
}

// ── Entry point ────────────────────────────────────────────────────

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Content negotiation runs first — if we rewrite, the security
  // headers still apply to the eventual response because we return
  // the rewrite response with them set.
  if (prefersMarkdown(req.headers.get('accept'))) {
    const twin = markdownTwin(pathname)
    if (twin) {
      const url = req.nextUrl.clone()
      url.pathname = twin
      const rewritten = NextResponse.rewrite(url)
      rewritten.headers.set('Vary', 'Accept')
      applySecurityHeaders(rewritten)
      return rewritten
    }
  }

  // Non-marketing paths that don't get CSP either.
  if (CSP_SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  applySecurityHeaders(res)
  return res
}

// Broad matcher: everything except Next internals and static files
// that don't render HTML.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
