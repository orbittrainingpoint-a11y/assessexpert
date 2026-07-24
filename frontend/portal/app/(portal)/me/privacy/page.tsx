'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import toast from 'react-hot-toast'
import { Download, Trash2, ShieldCheck, KeyRound } from 'lucide-react'

// User-facing GDPR self-service page. Any authenticated role can reach
// /me/privacy — the page just uses the caller's JWT to drive the two
// GDPR endpoints (export-my-data, delete-my-account).
//
// Also serves as the "regenerate MFA backup codes" surface — one
// place users manage the security-adjacent bits of their own account
// that aren't the password (password changes are on the profile modal
// in the top nav, which existed before).
export default function PrivacyPage() {
  const router = useRouter()
  const clearAuth = useAuthStore(s => s.clearAuth)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null)

  const handleExport = async () => {
    setDownloading(true)
    try {
      const res = await authApi.exportMyData()
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `assessexpert-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Data export downloaded')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Export failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    // Two-step confirmation: click "Delete", then type "delete my account"
    // in the confirm prompt. Reduces accidental clicks — this action is
    // irreversible from the UI.
    const answer = window.prompt(
      'This will permanently delete your account and blank out your personal data.\n\nType "delete my account" to confirm:',
    )
    if (answer !== 'delete my account') {
      toast.error('Deletion cancelled')
      return
    }
    setDeleting(true)
    try {
      await authApi.selfDelete()
      toast.success('Account deleted. Signing you out.')
      clearAuth()
      setTimeout(() => router.push('/login'), 1500)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed')
      setDeleting(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    if (!window.confirm('Regenerate MFA backup codes?\n\nYour existing codes will stop working.')) return
    setRegenerating(true)
    try {
      const { data } = await authApi.regenerateBackupCodes()
      setNewBackupCodes(data.codes)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not regenerate codes')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Privacy & Data</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Your rights over the personal data we hold about you.</p>
      </div>

      {/* Export */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ width: 40, height: 40, background: 'rgba(0,212,255,0.10)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Download size={20} color="var(--cyan)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Export your data (GDPR right to data portability)</h2>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Download a JSON file containing your profile, sessions you've proctored (metadata only), and audit-log entries where you were the actor. Password hashes, MFA secrets, and backup-code hashes are excluded — those are platform-side security data, not personal data in a GDPR sense.
            </p>
            <button className="btn-ghost" onClick={handleExport} disabled={downloading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> {downloading ? 'Preparing…' : 'Download my data'}
            </button>
          </div>
        </div>
      </div>

      {/* MFA backup codes */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ width: 40, height: 40, background: 'rgba(0,212,255,0.10)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <KeyRound size={20} color="var(--cyan)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>MFA backup codes</h2>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              If you lose your authenticator device, you can log in using a single-use backup code. Regenerating produces 10 new codes and invalidates the old ones.
            </p>
            {newBackupCodes ? (
              <div style={{ padding: '14px', background: 'rgba(217,119,6,0.06)', borderRadius: '8px', border: '1px solid rgba(217,119,6,0.25)' }}>
                <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: 'var(--amber)' }}>
                  <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                  Save these codes now — they won't be shown again
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontFamily: 'var(--font-mono-plex, monospace)', fontSize: 14, letterSpacing: 1 }}>
                  {newBackupCodes.map((c, i) => (
                    <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 4 }}>{c}</div>
                  ))}
                </div>
                <button className="btn-ghost" onClick={() => setNewBackupCodes(null)} style={{ marginTop: 10, fontSize: 12 }}>I've saved them</button>
              </div>
            ) : (
              <button className="btn-ghost" onClick={handleRegenerateBackupCodes} disabled={regenerating} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <KeyRound size={14} /> {regenerating ? 'Generating…' : 'Regenerate backup codes'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete */}
      <div className="glass-card" style={{ padding: '24px', borderColor: 'rgba(225,29,72,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ width: 40, height: 40, background: 'rgba(225,29,72,0.10)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 size={20} color="var(--rose)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Delete my account (GDPR right to erasure)</h2>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This permanently deletes your account and blanks out your name, email, phone, and profile photo from our database. The row itself is preserved to keep foreign-key integrity for sessions you've proctored — but nothing personally identifies you anymore. Cannot be undone through the UI.
            </p>
            <button className="btn-ghost" onClick={handleDelete} disabled={deleting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.4)' }}>
              <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
