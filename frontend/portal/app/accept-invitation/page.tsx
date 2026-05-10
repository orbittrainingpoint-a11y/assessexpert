'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

export default function AcceptInvitationPage() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''

  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) { setError('Invalid invitation link.'); return }
    api.get(`/users/invitation/${token}`)
      .then(r => setInvitation(r.data))
      .catch(e => setError(e.response?.data?.message || 'Invalid or expired invitation.'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.post('/users/accept-invitation', { token, ...form })
      toast.success('Account created! Please log in.')
      router.push('/login')
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '36px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--cyan)', margin: '0 0 4px' }}>AssessExpert</h1>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 24px' }}>Accept Invitation</h2>

        {error && (
          <div style={{ padding: '12px', background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.3)', borderRadius: '8px', color: 'var(--rose)', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {invitation && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Invited as <strong style={{ color: 'var(--text-primary)' }}>{invitation.role.replace(/_/g, ' ')}</strong> · {invitation.email}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {(['firstName', 'lastName'] as const).map(f => (
                <div key={f}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>{f === 'firstName' ? 'First Name *' : 'Last Name *'}</label>
                  <input className="form-input" required value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>Password *</label>
              <input className="form-input" type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>Confirm Password *</label>
              <input className="form-input" type="password" required value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '4px' }}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
