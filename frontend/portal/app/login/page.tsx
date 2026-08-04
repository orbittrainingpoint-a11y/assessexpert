'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import toast from 'react-hot-toast'

const ROLE_ROUTES: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  MASTER_PROCTOR: '/master-proctor',
  EXAM_SETUP_MASTER: '/exam-setup',
  SALES_AGENT: '/sales',
  ORG_ADMIN: '/hr',
  HR_MANAGER: '/hr',
  HIRING_MANAGER: '/hr',
  PROCTOR: '/proctor',
}

// If the user hit a protected page while unauthenticated, api.ts
// stashed the original URL in sessionStorage before bouncing them
// here. Consume it on successful login so they land back where they
// were mid-work instead of the role-default dashboard. Safe against
// open-redirect abuse — we only allow same-origin absolute paths.
// (PORTAL_GAPS.md H6.)
function consumeReturnTo(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('assessexpert.returnTo')
    sessionStorage.removeItem('assessexpert.returnTo')
    if (!raw) return null
    // Only relative paths — reject anything with a scheme or //
    // (which would resolve as a protocol-relative external URL).
    if (!raw.startsWith('/') || raw.startsWith('//')) return null
    if (raw.startsWith('/login') || raw.startsWith('/forgot-password')) return null
    return raw
  } catch { return null }
}

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [pendingUser, setPendingUser] = useState<any>(null)
  const [pendingTokens, setPendingTokens] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    const { data } = await authApi.login(loginEmail, loginPassword)
    if (data.requiresMfa) {
      setPendingUser(data.user)
      setPendingTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      setMfaStep(true)
    } else {
      setAuth(data.user, data.accessToken, data.refreshToken)
      const returnTo = consumeReturnTo()
      router.push(returnTo || ROLE_ROUTES[data.user.role] || '/hr')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await doLogin(email, password)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.verifyMfa(pendingUser.id, mfaToken)
      setAuth(pendingUser, pendingTokens.accessToken, pendingTokens.refreshToken)
      const returnTo = consumeReturnTo()
      router.push(returnTo || ROLE_ROUTES[pendingUser.role] || '/hr')
    } catch {
      toast.error('Invalid MFA code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--cyan)', fontSize: '28px', fontWeight: '700', margin: 0 }}>assessexpert</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Pre-Employment Assessment Platform</p>
        </div>

        <div className="glass-card" style={{ padding: '32px' }}>
          {!mfaStep ? (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', marginBottom: '24px', marginTop: 0 }}>Sign In</h2>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
                  <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '8px', width: '100%', padding: '12px' }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <a href="/forgot-password" style={{ display: 'block', textAlign: 'center', color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none', marginTop: '4px' }}>
                  Forgot your password?
                </a>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', marginBottom: '8px', marginTop: 0 }}>Two-Factor Authentication</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Enter the 6-digit code from your authenticator app.</p>
              <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input className="form-input" type="text" value={mfaToken} onChange={e => setMfaToken(e.target.value)} placeholder="000000" maxLength={6}
                  style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }} required />
                <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setMfaStep(false)} style={{ width: '100%' }}>Back</button>
              </form>
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
