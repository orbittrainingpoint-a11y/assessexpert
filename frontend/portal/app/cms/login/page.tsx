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
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
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
      localStorage.setItem('accessToken', data.accessToken)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
      router.replace('/cms')
    } catch {
      setError('Invalid email or password.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#040814', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} className="web-grid-bg">
      <div className="web-glow-orb" style={{ width: 420, height: 420, background: 'rgba(29,78,216,0.14)', top: '10%', left: '50%', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 28px rgba(59,130,246,0.4)' }}>
            <ShieldCheck size={28} color="#fff" />
          </div>
          <h1 style={{ color: '#F1F5F9', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px' }}>CMS Sign In</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>Content management — separate from the staff portal.</p>
        </div>

        <form onSubmit={submit} className="cms-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label htmlFor="cms-email" className="cms-label">Email</label>
            <input id="cms-email" className="cms-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cms@assessexpert.ae" />
          </div>
          <div>
            <label htmlFor="cms-pass" className="cms-label">Password</label>
            <input id="cms-pass" className="cms-input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <div role="alert" style={{ padding: '11px 14px', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)', borderRadius: 8, fontSize: 13, color: '#FB7185' }}>{error}</div>}
          <button className="cms-btn" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? <><Loader2 size={18} className="cms-spin" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: 13, marginTop: 20 }}>
          Staff portal? <a href="/login" style={{ color: '#60A5FA', textDecoration: 'none' }}>Sign in here</a>
        </p>
      </div>
    </div>
  )
}
