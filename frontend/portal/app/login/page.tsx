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

const DEMO_ACCOUNTS = [
  { role: 'Super Admin',        email: 'admin@assessexpert.ae',          password: 'Admin@assessexpert2026!',  color: '#E11D48', badge: 'SA' },
  { role: 'Master Proctor',     email: 'masterproctor@assessexpert.ae',  password: 'MasterProctor@2026!',      color: '#7C3AED', badge: 'MP' },
  { role: 'Exam Setup Master',  email: 'examsetup@assessexpert.ae',      password: 'ExamSetup@2026!',          color: '#0891B2', badge: 'ES' },
  { role: 'Proctor',            email: 'proctor@assessexpert.ae',        password: 'Proctor@2026!',            color: '#059669', badge: 'PR' },
  { role: 'Sales Agent',        email: 'sales@assessexpert.ae',          password: 'Sales@2026!',              color: '#D97706', badge: 'SL' },
  { role: 'HR Manager',         email: 'hr@democompany.ae',              password: 'HRManager@2026!',          color: '#00D4FF', badge: 'HR' },
]

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
  const [quickLoading, setQuickLoading] = useState<string | null>(null)

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    const { data } = await authApi.login(loginEmail, loginPassword)
    if (data.requiresMfa) {
      setPendingUser(data.user)
      setPendingTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      setMfaStep(true)
    } else {
      setAuth(data.user, data.accessToken, data.refreshToken)
      router.push(ROLE_ROUTES[data.user.role] || '/hr')
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

  const handleQuickLogin = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setQuickLoading(acc.email)
    try {
      await doLogin(acc.email, acc.password)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setQuickLoading(null)
    }
  }

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.verifyMfa(pendingUser.id, mfaToken)
      setAuth(pendingUser, pendingTokens.accessToken, pendingTokens.refreshToken)
      router.push(ROLE_ROUTES[pendingUser.role] || '/hr')
    } catch {
      toast.error('Invalid MFA code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '900px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* LEFT — Login Form */}
        <div>
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

        {/* RIGHT — Demo Credentials */}
        <div>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '20px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', fontSize: '12px', color: 'var(--cyan)', fontWeight: '600', letterSpacing: '0.05em' }}>
              DEMO ACCOUNTS — QUICK ACCESS
            </span>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Click any role to log in instantly
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => handleQuickLogin(acc)}
                  disabled={!!quickLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                    background: quickLoading === acc.email ? `${acc.color}18` : 'var(--bg-elevated)',
                    border: `1px solid ${quickLoading === acc.email ? acc.color + '44' : 'var(--border)'}`,
                    transition: 'all 0.15s', textAlign: 'left', width: '100%',
                    opacity: quickLoading && quickLoading !== acc.email ? 0.5 : 1,
                  }}
                >
                  {/* Badge */}
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: `${acc.color}22`, border: `1px solid ${acc.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: acc.color, flexShrink: 0 }}>
                    {quickLoading === acc.email ? '⏳' : acc.badge}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{acc.role}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</p>
                  </div>

                  {/* Arrow */}
                  <span style={{ fontSize: '14px', color: acc.color, flexShrink: 0 }}>
                    {quickLoading === acc.email ? '' : '→'}
                  </span>
                </button>
              ))}
            </div>

            {/* Credentials table */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Credentials</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {DEMO_ACCOUNTS.map(acc => (
                  <div key={acc.email} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '6px 8px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.password}</span>
                  </div>
                ))}
              </div>

              {/* Candidate magic link */}
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(0,212,255,0.06)', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.15)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--cyan)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate (Magic Link)</p>
                <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)' }}>Ahmed Al-Rashidi — no password, link only</p>
                <a
                  href="/exam?token=DEMO-AHMED-2026-ACAD-L1-TOKEN"
                  style={{ display: 'inline-block', fontSize: '11px', color: 'var(--cyan)', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '6px' }}
                >
                  Open Candidate Exam →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
