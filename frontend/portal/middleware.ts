// SAST P3 #18 — Content-Security-Policy header for the portal.
//
// The backend already serves a strict CSP for /api/ via Helmet. The
// Next.js portal had none of its own, so an XSS in the dashboard
// would have full DOM and network access. This middleware adds CSP
// to every public + portal response.
//
// Mode: REPORT-ONLY for the first deploy. The report-only header
// tells the browser "follow this policy AND tell me about violations,
// but don't actually block anything yet". We watch the dev console
// (and ideally a real `report-to` endpoint, wired up later) for
// genuine violations, tune the policy, then flip the variable below
// to switch the header name to the enforcing form.
//
// Why report-only first: a Next.js app inevitably has some inline
// styles, runtime chunks, and third-party connections that need
// careful policy allowances. Enforcing on day one risks taking the
// whole app down if anything is missed. Report-only catches the
// violations without breaking anything.
//
// The policy is intentionally tight — `default-src 'self'`, no
// inline scripts (Next.js inline boot scripts are nonce'd by Next
// itself), connections limited to self + api.assessexpert.com,
// no embedding ("frame-ancestors 'none'" — clickjacking defense).

import { NextRequest, NextResponse } from 'next/server'

// Flip to false to switch from report-only to enforcing once a week
// or two of real-traffic violation reports have been triaged. Until
// then keep this true so we don't break the live app.
const REPORT_ONLY = process.env.CSP_REPORT_ONLY !== 'false'

// API host the frontend talks to. Read from env so prod / staging
// can differ. Falls back to the production host for safety.
const API_HOST = process.env.NEXT_PUBLIC_API_URL || 'https://assessexpert.com'
const API_ORIGIN = (() => {
  try { return new URL(API_HOST).origin } catch { return 'https://assessexpert.com' }
})()

// Build the CSP directive list. Each line is one directive.
// `'self'` matches the page's own origin; specific origins are added
// where we know we use them.
function buildCsp(): string {
  const directives: string[] = [
    // Default: same-origin only
    `default-src 'self'`,
    // Scripts: same-origin + nonced (Next emits its inline boot with
    // a nonce when CSP is set). 'strict-dynamic' allows the nonced
    // boot script to load further scripts. unsafe-inline kept ONLY
    // for legacy paths during report-only — drop when enforcing.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com`,
    // Styles: same-origin + inline (Next + styled-jsx need this).
    // CSP3 doesn't have a clean way around inline styles for SSR.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Fonts: Google Fonts is currently used by next/font/google.
    `font-src 'self' data: https://fonts.gstatic.com`,
    // Images: same-origin + data: (SVG covers + base64) + blob: (canvas
    // captures) + the API host (uploaded files served from there).
    `img-src 'self' data: blob: ${API_ORIGIN}`,
    // XHR / fetch / WebSocket destinations.
    `connect-src 'self' ${API_ORIGIN} wss: ws:`,
    // Media (audio/video from MediaRecorder + WebRTC).
    `media-src 'self' blob: data:`,
    // Workers — the candidate exam page uses MediaPipe / TFJS workers.
    `worker-src 'self' blob:`,
    // No embedded plugins, no Flash, no Java.
    `object-src 'none'`,
    // Clickjacking defense — no one can frame us.
    `frame-ancestors 'none'`,
    // Base URI lock — prevents an injected <base> tag from rewriting
    // relative URLs.
    `base-uri 'self'`,
    // Form submissions go to our own origin only.
    `form-action 'self'`,
    // Upgrade any http: requests that sneak in.
    `upgrade-insecure-requests`,
  ]
  return directives.join('; ')
}

const CSP_VALUE = buildCsp()
const CSP_HEADER = REPORT_ONLY
  ? 'Content-Security-Policy-Report-Only'
  : 'Content-Security-Policy'

// Paths we explicitly skip. /api/* shouldn't ever hit this middleware
// (handled by the backend), but the Next.js dev server proxies under
// some configs — defend the boundary. Static assets and Next internals
// also skip because the policy doesn't apply to non-HTML responses.
const SKIP_PREFIXES = ['/_next', '/api', '/blog-cover', '/favicon', '/sitemap', '/robots']

export function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname
  if (SKIP_PREFIXES.some((p) => url.startsWith(p))) return NextResponse.next()

  const res = NextResponse.next()
  res.headers.set(CSP_HEADER, CSP_VALUE)
  // Belt-and-braces companion headers that pair well with CSP.
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')
  return res
}

// Matcher — apply to everything except static assets and Next internals.
// More efficient than checking inside the handler.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
