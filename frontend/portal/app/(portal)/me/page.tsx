'use client'

// Self-service profile page (PORTAL_GAPS.md L3).
//
// Every authenticated user gets access — the backend enforces req.user.id
// on PUT /users/me + a SELF_WRITABLE_FIELDS allowlist so callers can't
// escalate role or move tenants from here. This page is intentionally
// narrow: what a user actually needs to update themselves without
// pinging an admin.

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { authApi, usersApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { User } from 'lucide-react'

interface ProfileForm {
  firstName: string
  lastName: string
  phone: string
  jobTitle: string
  timezone: string
  preferredLanguage: string
}

const EMPTY: ProfileForm = {
  firstName: '',
  lastName: '',
  phone: '',
  jobTitle: '',
  timezone: '',
  preferredLanguage: 'en',
}

export default function MeProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [form, setForm] = useState<ProfileForm>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)

  // Load the full profile — the auth store only carries a subset.
  useEffect(() => {
    let cancelled = false
    authApi.me()
      .then((r) => {
        if (cancelled) return
        setForm({
          firstName: r.data.firstName || '',
          lastName: r.data.lastName || '',
          phone: r.data.phone || '',
          jobTitle: r.data.jobTitle || '',
          timezone: r.data.timezone || '',
          preferredLanguage: r.data.preferredLanguage || 'en',
        })
        setInitialLoaded(true)
      })
      .catch(() => { if (!cancelled) toast.error('Could not load your profile') })
    return () => { cancelled = true }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await usersApi.updateMe({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        jobTitle: form.jobTitle,
        timezone: form.timezone,
        preferredLanguage: form.preferredLanguage,
      })
      // Keep the store in sync so the sidebar name updates immediately.
      updateUser({
        firstName: data.firstName,
        lastName: data.lastName,
      })
      toast.success('Profile saved')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return <div style={{ padding: 24 }}>Sign in required</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--cyan)',
        }}>
          <User size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary)', fontWeight: 700 }}>Your profile</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {user.email} · {user.role.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="glass-card" style={{ padding: 24, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="First name" value={form.firstName} onChange={(v) => setForm(f => ({ ...f, firstName: v }))} required />
          <Field label="Last name"  value={form.lastName}  onChange={(v) => setForm(f => ({ ...f, lastName:  v }))} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Phone"      value={form.phone}     onChange={(v) => setForm(f => ({ ...f, phone: v }))} type="tel" placeholder="+971 5X XXX XXXX" />
          <Field label="Job title"  value={form.jobTitle}  onChange={(v) => setForm(f => ({ ...f, jobTitle: v }))} placeholder="HR Manager" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Timezone"   value={form.timezone}  onChange={(v) => setForm(f => ({ ...f, timezone: v }))} placeholder="Asia/Dubai" />
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Preferred language</label>
            <select
              className="form-input"
              value={form.preferredLanguage}
              onChange={(e) => setForm(f => ({ ...f, preferredLanguage: e.target.value }))}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !initialLoaded}
            style={{ padding: '10px 22px' }}
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Related self-service (already exists — deep links). */}
      <div style={{ marginTop: 32, display: 'grid', gap: 12 }}>
        <a
          href="/me/privacy"
          style={{
            display: 'block', padding: '14px 18px', borderRadius: 8,
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', textDecoration: 'none',
          }}
        >
          <strong style={{ fontSize: 14 }}>Privacy &amp; data (GDPR)</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Export your data or delete your account.
          </div>
        </a>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', required, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}{required ? ' *' : ''}
      </label>
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  )
}
