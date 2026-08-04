import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/marketing-content'

// Progressive Web App manifest (PORTAL_GAPS.md L1, minimum viable).
//
// Ships enough for iOS + Android "Add to Home Screen" to produce a
// standalone-launched app icon that opens straight into the portal.
// Does NOT ship a service worker — the exam flow is entirely
// server-authoritative (session state, questions, submissions,
// proctor streams), so a cached offline version could show a
// candidate a stale exam and let them think they've submitted
// answers that never left the browser. Better UX to keep the
// existing "connection lost" overlay + retry semantics than to
// bolt on an offline shell we couldn't confidently ship.
//
// Icons reference /icon.svg and /apple-touch-icon.png at the app
// root — Next.js also picks those up as favicons via the metadata
// icons convention, so a single asset serves manifest + head tags.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.brand,
    description: SITE.tagline,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0f1e',
    theme_color: '#216dff',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['business', 'productivity', 'education'],
    lang: 'en',
    dir: 'ltr',
  }
}
