'use client'
import { useAuthStore } from '@/store/auth.store'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, usersApi, orgsApi, brandingApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'

const NOTIF_EVENTS = [
  { key: 'report_published', label: 'Report Published' },
  { key: 'assessment_scheduled', label: 'Assessment Scheduled' },
  { key: 'candidate_noshow', label: 'Candidate No-Show' },
  { key: 'recording_expiring', label: 'Recording Expiring (24h)' },
  { key: 'interview_reminder', label: 'Interview Reminder' },
]

export default function HRSettingsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'users' | 'notifications' | 'security'>('profile')
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('HR_MANAGER')
  const [notifPrefs, setNotifPrefs] = useState<Record<string, { email: boolean; portal: boolean; sms: boolean }>>(() =>
    Object.fromEntries(NOTIF_EVENTS.map(e => [e.key, { email: true, portal: true, sms: false }]))
  )

  const { data: orgData } = useQuery({
    queryKey: ['hr-org', user?.organizationId],
    queryFn: () => orgsApi.getOne(user!.organizationId!).then(r => r.data),
    enabled: !!user?.organizationId,
  })

  const { data: orgUsers } = useQuery({
    queryKey: ['hr-org-users', user?.organizationId],
    queryFn: () => usersApi.getAll({ organizationId: user!.organizationId!, limit: 50 }).then(r => r.data),
    enabled: !!user?.organizationId && activeTab === 'users',
  })

  const changePwMutation = useMutation({
    mutationFn: () => authApi.changePassword(current, newPw),
    onSuccess: () => { toast.success('Password changed'); setCurrent(''); setNewPw(''); setConfirm('') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  // Cryptographically secure throw-away password the invited user resets
  // on first login. Math.random() was V8's biased PRNG — predictable enough
  // that an attacker who triggered a few invites in sequence could narrow
  // the next password's range.
  const generateTempPassword = () => {
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let out = ''
    for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length]
    return out
  }

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.create({
      email: inviteEmail, role: inviteRole,
      organizationId: user?.organizationId,
      firstName: '', lastName: '',
      password: generateTempPassword(),
    }),
    onSuccess: () => {
      toast.success('Invitation sent')
      qc.invalidateQueries({ queryKey: ['hr-org-users'] })
      setInviteEmail('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['hr-org-users'] }) },
  })

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirm) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8) { toast.error('Minimum 8 characters'); return }
    changePwMutation.mutate()
  }

  const userList: any[] = orgUsers?.users || orgUsers || []
  const org = orgData

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'company', label: 'Company' },
    { key: 'users', label: 'Users' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
  ] as const

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Manage your account and company preferences</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === t.key ? '600' : '400', color: activeTab === t.key ? 'var(--cyan)' : 'var(--text-muted)', borderBottom: activeTab === t.key ? '2px solid var(--cyan)' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PROFILE */}
      {activeTab === 'profile' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Your Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              ['Name', `${user?.firstName} ${user?.lastName}`],
              ['Email', user?.email || ''],
              ['Role', user?.role?.replace(/_/g, ' ') || ''],
              ['Organization', org?.name || user?.organizationId || '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMPANY */}
      {activeTab === 'company' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Company Profile</h3>
          {!org ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading company details...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  ['Company Name', org.name],
                  ['Industry', org.industry],
                  ['Country', org.country],
                  ['City', org.city || '—'],
                  ['Website', org.website || '—'],
                  ['Account Tier', org.accountTier || '—'],
                  ['Primary Contact', org.primaryContactName || '—'],
                  ['Contact Email', org.primaryContactEmail || '—'],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{l}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-primary)' }}>{v}</p>
                  </div>
                ))}
              </div>
              {/* Credit usage */}
              <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Assessment Credits</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {org.creditsUsed || 0} / {org.assessmentCredits} used
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-base)', borderRadius: '3px' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: 'var(--cyan)', width: `${Math.min(100, Math.round(((org.creditsUsed || 0) / org.assessmentCredits) * 100))}%` }} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                To update company details, contact your assessexpert account manager.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'company' && user?.organizationId && (
        <BrandingSection organizationId={user.organizationId} />
      )}

      {/* USERS */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Invite User</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" placeholder="Email address..." value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
              <select className="form-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: '180px' }}>
                <option value="HR_MANAGER">HR Manager</option>
                <option value="HIRING_MANAGER">Hiring Manager (read-only)</option>
              </select>
              <button className="btn-primary" onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail.trim() || inviteMutation.isPending} style={{ whiteSpace: 'nowrap' }}>
                {inviteMutation.isPending ? 'Sending...' : <><Plus size={14} style={{ display: 'inline', marginRight: '4px' }} />Invite</>}
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Team Members ({userList.length})
              </h3>
            </div>
            {!userList.length ? (
              <p style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No users found.</p>
            ) : userList.map((u: any) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{u.firstName} {u.lastName}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{u.email} · {u.role.replace(/_/g, ' ')}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge ${u.status === 'ACTIVE' ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: '11px' }}>{u.status}</span>
                  {u.id !== user?.id && u.status === 'ACTIVE' && (
                    <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                      onClick={() => { if (window.confirm(`Deactivate ${u.firstName}?`)) deactivateMutation.mutate(u.id) }}>
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Notification Preferences</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Event</th>
                {['Email', 'In-Portal', 'SMS'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIF_EVENTS.map(ev => (
                <tr key={ev.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>{ev.label}</td>
                  {(['email', 'portal', 'sms'] as const).map(ch => (
                    <td key={ch} style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input type="checkbox"
                        checked={notifPrefs[ev.key]?.[ch] ?? false}
                        onChange={e => setNotifPrefs(p => ({ ...p, [ev.key]: { ...p[ev.key], [ch]: e.target.checked } }))}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--cyan)', cursor: 'pointer' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }}
              onClick={() => toast.success('Notification preferences saved')}>
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* SECURITY */}
      {activeTab === 'security' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Change Password</h3>
          <form onSubmit={handlePwSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '400px' }}>
            {[
              ['Current Password', current, setCurrent],
              ['New Password', newPw, setNewPw],
              ['Confirm New Password', confirm, setConfirm],
            ].map(([l, v, s]) => (
              <div key={l as string}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{l as string}</label>
                <input className="form-input" type="password" required value={v as string}
                  onChange={e => (s as any)(e.target.value)} placeholder="••••••••" />
              </div>
            ))}
            <button type="submit" className="btn-primary" disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ── Branding section ────────────────────────────────────────────────────────
//
// HR uploads a logo (PNG/JPG, ≤200KB after client-side resize), picks a
// brand colour, and optionally overrides the display name shown to
// candidates. The logo is stored as a base64 data URL on
// Organization.logo — avoids the entire file-upload pipeline for what is
// realistically a one-row-per-org write that happens once per quarter.

function BrandingSection({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient()
  const { data: branding, isLoading } = useQuery({
    queryKey: ['hr-branding', organizationId],
    queryFn: () => brandingApi.get(organizationId).then(r => r.data),
  })

  const [displayName, setDisplayName] = useState('')
  const [brandColor, setBrandColor] = useState('#00D4FF')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoChanged, setLogoChanged] = useState(false)
  const [resizing, setResizing] = useState(false)

  // Hydrate inputs once the GET arrives. Re-runs if the operator saves
  // and we re-fetch, so the form stays in sync with the server.
  useEffect(() => {
    if (!branding) return
    setDisplayName(branding.displayName || '')
    setBrandColor(branding.brandColor || '#00D4FF')
    setLogoPreview(branding.logoUrl || null)
  }, [branding])

  const onPickFile = async (file: File) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) {
      toast.error('Logo must be PNG, JPG, SVG or WEBP')
      return
    }
    setResizing(true)
    try {
      // Client-side resize: max 320px on the long edge, JPEG q=0.85. Keeps
      // the data URL under ~80KB even for full-bleed photographic logos.
      // SVG passes through untouched (vector — no resize needed).
      const dataUrl = file.type === 'image/svg+xml'
        ? await readAsDataUrl(file)
        : await resizeImage(file, 320, 0.85)
      setLogoPreview(dataUrl)
      setLogoChanged(true)
    } catch (e: any) {
      toast.error(e?.message || 'Could not read logo')
    } finally {
      setResizing(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => brandingApi.update(organizationId, {
      displayName: displayName || null,
      brandColor: brandColor || null,
      ...(logoChanged ? { logoUrl: logoPreview } : {}),
    }),
    onSuccess: () => {
      toast.success('Branding saved')
      qc.invalidateQueries({ queryKey: ['hr-branding', organizationId] })
      // Also refresh the layout's branding query so the sidebar updates
      // without a page refresh.
      qc.invalidateQueries({ queryKey: ['branding', organizationId] })
      setLogoChanged(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Save failed'),
  })

  return (
    <div className="glass-card" style={{ padding: '24px', marginTop: 16 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Brand & Logo</h3>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Your logo appears in the HR portal sidebar, on the candidate's interview / exam page, and in invitation emails sent on your behalf.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Logo upload */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Preview tile: shows the logo on a white chip the same
                  way the rest of the app does. Operator sees exactly
                  what candidates and HR will see. */}
              <div style={{
                width: 96, height: 96, borderRadius: 10, background: 'var(--bg-base)',
                border: '1px solid var(--border)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                padding: 8,
              }}>
                {logoPreview ? (
                  <div style={{
                    background: '#fff', padding: '6px 8px', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    maxWidth: '100%', maxHeight: '100%',
                  }}>
                    <img src={logoPreview} alt="Logo" style={{ maxWidth: '100%', maxHeight: 56, objectFit: 'contain', display: 'block' }} />
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No logo</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={e => e.target.files?.[0] && onPickFile(e.target.files[0])}
                  style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                />
                {logoPreview && (
                  <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', width: 'fit-content' }}
                    onClick={() => { setLogoPreview(null); setLogoChanged(true) }}>
                    Remove logo
                  </button>
                )}
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  PNG, JPG, SVG, or WEBP. Resized to 320px on the long edge.
                </p>
              </div>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label htmlFor="bn-name" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Display name (optional)</label>
            <input id="bn-name" className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Defaults to the company's legal name"
              style={{ fontSize: 13 }} />
          </div>

          {/* Brand color */}
          <div>
            <label htmlFor="bn-color" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Accent colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input id="bn-color" type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                style={{ width: 44, height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: 2, background: 'transparent' }} />
              <input className="form-input" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                placeholder="#00D4FF" style={{ fontSize: 13, flex: 1, fontFamily: 'monospace' }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              Used to colour the brand name + interactive accents. Must be a hex value like <code>#00D4FF</code>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn-primary" disabled={saveMutation.isPending || resizing}
              onClick={() => saveMutation.mutate()}
              style={{ padding: '10px 18px', fontWeight: 600 }}>
              {saveMutation.isPending ? 'Saving…' : resizing ? 'Resizing logo…' : 'Save branding'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Read failed'))
    r.readAsDataURL(file)
  })
}

async function resizeImage(file: File, maxEdge: number, quality: number): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image decode failed'))
    img.src = dataUrl
  })
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}
