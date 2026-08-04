'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { authApi } from '@/lib/api'
import { CMS_ROLES } from '@/lib/cms-admin-api'

export default function CmsLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already signed in with a CMS role? Skip straight to the dashboard.
  // Token is now an httpOnly cookie — we can't peek at it from JS.
  // Just ask /auth/me and let it 401 if no cookie is present.
  useEffect(() => {
    authApi.me().then((r) => { if (CMS_ROLES.includes(r.data.role)) router.replace('/cms') }).catch(() => {})
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.login(email, password)
      if (data.requiresMfa) {
        setError('This account requires MFA. Please use the staff portal login.')
        setLoading(false)
        return
      }
      if (!data.accessToken || !CMS_ROLES.includes(data.user?.role)) {
        setError('This account does not have CMS access.')
        setLoading(false)
        return
      }
      // No localStorage token writes any more — the backend set
      // httpOnly `access_token` + `refresh_token` cookies on this same
      // response, which every subsequent /api call will send
      // automatically via `withCredentials: true`.
      // (PORTAL_GAPS.md C1.)
      router.replace('/cms')
    } catch {
      setError('Invalid email or password.')
      setLoading(false)
    }
  }

  return (
    <div className="cms-login web-grid-bg">
      <div className="web-glow-orb" style={{ width: 520, height: 520, background: 'rgba(33,115,255,0.2)', top: '4%', left: '50%', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="cms-login-mark">
            <ShieldCheck size={28} color="#fff" />
          </div>
          <h1 style={{ color: 'var(--web-text)', fontFamily: 'var(--web-serif)', fontSize: 27, fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 8px' }}>Content Studio</h1>
          <p style={{ color: 'var(--web-text-secondary)', fontSize: 14, margin: 0 }}>Manage the public AssessExpert experience.</p>
        </div>

        <form onSubmit={submit} className="cms-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label htmlFor="cms-email" className="cms-label">Email</label>
            <input id="cms-email" className="cms-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cms@assessexpert.ae" />
          </div>
          <div>
            <label htmlFor="cms-pass" className="cms-label">Password</label>
            <input id="cms-pass" className="cms-input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
          </div>
          {error && <div role="alert" style={{ padding: '11px 14px', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)', borderRadius: 8, fontSize: 13, color: '#FB7185' }}>{error}</div>}
          <button className="cms-btn" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? <><Loader2 size={18} className="cms-spin" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: 13, marginTop: 20 }}>
          Staff portal? <a href="/login" style={{ color: 'var(--web-gold-light)', textDecoration: 'none' }}>Sign in here</a>
        </p>
      </div>
    </div>
  )
}
