'use client'

// App Router global error boundary. Catches render-time crashes that
// would otherwise show a blank screen (or Next's default error page) in
// production. Keeps the user in a recoverable state with a "try again"
// action instead of a dead tab.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, sans-serif', background: '#060B18', color: '#F1F5F9' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ color: '#00D4FF', fontSize: '22px', margin: 0 }}>AssessExpert</h1>
          <h2 style={{ fontSize: '18px', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#94A3B8', maxWidth: '420px', lineHeight: 1.6, margin: 0 }}>
            An unexpected error occurred. Your session is safe — try reloading this
            view. If the problem persists, contact your administrator.
          </p>
          {error?.digest && (
            <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: '8px',
              background: '#00D4FF',
              color: '#060B18',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
