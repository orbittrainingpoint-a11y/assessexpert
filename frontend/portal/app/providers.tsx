'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'

// Sentry error monitoring — opt-in via NEXT_PUBLIC_SENTRY_DSN.
//
// Using @sentry/browser directly rather than @sentry/nextjs because
// the Next 16 wrapper has bundler-plugin behaviour that this codebase
// hasn't verified against (see frontend/portal/AGENTS.md — Next 16
// has breaking changes vs training data). The plain browser SDK
// gives us error + breadcrumb + performance capture without touching
// next.config or turbopack. If we later want release healthchecks
// and source-map upload, upgrade to @sentry/nextjs then.
//
// No-op if DSN is unset — dev and any deploy without a Sentry
// account keeps working.
let sentryInited = false
async function initSentry() {
  if (sentryInited) return
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  try {
    const Sentry = await import('@sentry/browser')
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_APP_ENV || 'production',
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) || 0.1,
      // Never capture user credentials or magic-link tokens in
      // breadcrumbs.
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
          const url = (breadcrumb.data as any)?.url || ''
          if (/\/(login|reset-password|verify-otp|verify-magic|forgot-password|verify-email|reset)/.test(url)) {
            return null
          }
        }
        return breadcrumb
      },
    })
    sentryInited = true
  } catch {
    // Silently degrade — Sentry isn't critical to the app running.
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000, retry: 1 },
    },
  }))

  // Init Sentry once on client-side mount.
  useEffect(() => { initSentry() }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>{children}</LocaleProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0D1526',
            color: '#F1F5F9',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#059669', secondary: '#F1F5F9' } },
          error: { iconTheme: { primary: '#E11D48', secondary: '#F1F5F9' } },
        }}
      />
    </QueryClientProvider>
  )
}
