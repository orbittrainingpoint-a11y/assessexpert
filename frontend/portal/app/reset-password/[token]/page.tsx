'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'

// Public reset-password consumer. Reads the token from the URL,
// prompts for the new password, then POSTs to /auth/reset-password.
// Backend returns a constant-shape error for invalid/expired to
// prevent token enumeration (see users.service.completePasswordReset).
export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params?.token || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      // Give the user a moment to read the success state before redirecting.
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reset link is invalid or expired')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--cyan)', fontSize: '28px', fontWeight: '700', margin: 0 }}>assessexpert</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Set a new password</p>
        </div>

        <div className="glass-card" style={{ padding: '32px' }}>
          {!done ? (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', marginBottom: '8px', marginTop: 0 }}>Choose a new password</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                Pick at least 8 characters. You'll be redirected to sign in once it's saved.
              </p>
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>New password</label>
                  <input className="form-input" type="password" required minLength={8} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Confirm password</label>
                  <input className="form-input" type="password" required minLength={8} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
                </div>
                <button className="btn-primary" type="submit" disabled={loading || !password || !confirmPassword} style={{ marginTop: '8px', width: '100%', padding: '12px' }}>
                  {loading ? 'Saving…' : 'Save new password'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ color: 'var(--emerald)', fontSize: '20px', fontWeight: '600', marginBottom: '8px', marginTop: 0 }}>Password updated</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                Your password has been changed. Redirecting to sign-in…
              </p>
              <a href="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '12px', textDecoration: 'none' }}>
                Go to sign in
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
