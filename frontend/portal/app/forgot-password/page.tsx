'use client'
import { useState } from 'react'
import { authApi } from '@/lib/api'

// Public forgot-password entry. Deliberately returns the same success
// message whether or not the email exists — matches the backend's
// non-enumeration guarantee (see users.service.requestPasswordReset).
// The real send outcome is only visible in the server-side log.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } catch {
      // Same UI regardless — we don't leak whether the email exists.
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--cyan)', fontSize: '28px', fontWeight: '700', margin: 0 }}>assessexpert</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Reset your password</p>
        </div>

        <div className="glass-card" style={{ padding: '32px' }}>
          {!submitted ? (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', marginBottom: '8px', marginTop: 0 }}>Forgot password</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                Enter the email on your account. We'll send a link valid for 1 hour to reset your password.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
                  <input className="form-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoFocus />
                </div>
                <button className="btn-primary" type="submit" disabled={loading || !email} style={{ marginTop: '8px', width: '100%', padding: '12px' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <a href="/login" style={{ display: 'block', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none' }}>
                  Back to sign in
                </a>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', marginBottom: '8px', marginTop: 0 }}>Check your email</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                If an account exists for <strong>{email}</strong>, we've sent it a reset link. The link is valid for 1 hour.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '24px', lineHeight: 1.6 }}>
                Didn't get it? Check the spam folder. Still nothing after 5 minutes — the email may not be registered. Try again with a different address, or contact your admin.
              </p>
              <a href="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '12px', textDecoration: 'none' }}>
                Back to sign in
              </a>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}>
          assessexpert | Powered by Orbit Training · Dubai, UAE
        </p>
      </div>
    </div>
  )
}
