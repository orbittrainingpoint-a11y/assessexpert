'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { authApi } from '@/lib/api'

// Public email verification consumer. Grabs the token from the URL
// and POSTs to /auth/verify-email exactly once on mount. Success sets
// emailVerifiedAt server-side. Users can log in before verifying —
// this is a nice-to-have, not a gate — but critical actions (GDPR
// export, for now) may require it.
export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token || ''
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); setMessage('Missing verification token'); return }
    (async () => {
      try {
        const { data } = await authApi.verifyEmail(token)
        setMessage(`Verified ${data.email}. You can close this tab.`)
        setState('ok')
      } catch (err: any) {
        setMessage(err.response?.data?.message || 'Verification link is invalid')
        setState('error')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--cyan)', fontSize: '28px', fontWeight: '700', margin: 0 }}>assessexpert</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Email verification</p>
        </div>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: state === 'ok' ? 'var(--emerald)' : state === 'error' ? 'var(--rose)' : 'var(--text-primary)', fontSize: '20px', fontWeight: '600', marginBottom: '12px', marginTop: 0 }}>
            {state === 'pending' && 'Verifying…'}
            {state === 'ok' && 'Email verified'}
            {state === 'error' && 'Verification failed'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            {message || 'Please wait…'}
          </p>
          <a href="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '12px', textDecoration: 'none' }}>
            Go to sign in
          </a>
        </div>
      </div>
    </div>
  )
}
