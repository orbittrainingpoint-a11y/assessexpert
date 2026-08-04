'use client'

// Shared error reporter. Replaces the `.catch(() => {})` blocks that
// used to silently swallow real failures across the app.
//
// Behaviour:
//   - dev / missing DSN: logs to console so devs see failures immediately
//   - prod with Sentry initialised: forwards to Sentry.captureException
//     with an optional short context tag (e.g. 'session-recorder-upload')
//     so the same alert grouped by hook is legible in the Sentry issues UI
//
// Import from anywhere — the Sentry SDK is dynamically loaded the first
// time this is called so we don't pull it into pages that never fail.

let sentryPromise: Promise<any> | null = null
async function getSentry(): Promise<any | null> {
  if (typeof window === 'undefined') return null
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return null
  if (!sentryPromise) {
    sentryPromise = import('@sentry/browser').catch(() => null)
  }
  return sentryPromise
}

/**
 * Report a caught error. Never throws.
 *
 * @param err     The thing you caught. Any type — non-Error values are
 *                stringified to a Message.
 * @param context Short kebab-case tag identifying WHERE the error came
 *                from (`'recorder-finalize'`, `'fr-cdn-fetch'`, etc.).
 *                Ends up as Sentry tags.location so alerts are groupable.
 */
export function captureError(err: unknown, context?: string): void {
  // Dev/local: log so devs see it. Also runs in prod when console.log
  // is stripped — console.error is preserved by next.config.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[captureError${context ? ` ${context}` : ''}]`, err)
  } else {
    // eslint-disable-next-line no-console
    console.error(`[captureError${context ? ` ${context}` : ''}]`, err)
  }
  // Best-effort forward to Sentry. Never awaited by the caller — errors
  // that happen inside error reporting must not cascade.
  getSentry().then((S) => {
    if (!S) return
    try {
      const exc = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err))
      if (context) {
        S.withScope((scope: any) => {
          scope.setTag('location', context)
          S.captureException(exc)
        })
      } else {
        S.captureException(exc)
      }
    } catch {
      // Reporting failure — swallowed on purpose.
    }
  }).catch(() => {})
}
