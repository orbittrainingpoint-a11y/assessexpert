'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { Save, Search, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const SETTING_LABELS: Record<string, { label: string; desc: string; type: string }> = {
  recording_retention_days: { label: 'Recording Retention (days)', desc: 'Days before session recordings are auto-purged', type: 'number' },
  fr_image_retention_days: { label: 'FR Image Retention (days)', desc: 'Days before facial recognition images are purged', type: 'number' },
  max_concurrent_sessions: { label: 'Max Concurrent Sessions', desc: 'Platform-wide concurrent session limit', type: 'number' },
  fr_similarity_threshold_verified: { label: 'FR Verified Threshold (%)', desc: 'Similarity score required for auto-verification', type: 'number' },
  fr_similarity_threshold_review: { label: 'FR Review Threshold (%)', desc: 'Similarity score below which manual review is triggered', type: 'number' },
  fr_check_interval_seconds: { label: 'FR Check Interval (seconds)', desc: 'How often facial recognition checks run during exam', type: 'number' },
  face_absence_threshold_seconds: { label: 'Face Absence Alert (seconds)', desc: 'Seconds before face-absent event is flagged', type: 'number' },
  tab_switch_escalation_count: { label: 'Tab Switch Escalation Count', desc: 'Number of tab switches before auto-escalation', type: 'number' },
  min_proctor_narrative_chars: { label: 'Min Proctor Narrative (chars)', desc: 'Minimum characters required in proctor narrative to publish', type: 'number' },
  report_sla_hours: { label: 'Report SLA (hours)', desc: 'Target hours from session end to published report', type: 'number' },
}

// `comingSoon: true` greys the toggle out and prevents it from flipping
// — the underlying setting is still saved (so when the feature ships we
// can flip an existing org's flag without re-typing), but the UI makes
// it clear the toggle currently doesn't do anything.
const FEATURE_FLAGS: Array<{ key: string; label: string; desc: string; comingSoon?: boolean }> = [
  { key: 'notify_candidate_on_publish', label: 'Email Candidate on Report Publish', desc: 'When ON, candidates receive a courtesy email when their result is published' },
  { key: 'interview_room', label: 'Interview Room', desc: 'Built-in video interview room for HR', comingSoon: true },
  { key: 'cloud_vdi', label: 'Cloud VDI (Lab Mode)', desc: 'Cloud desktop for candidates without required software', comingSoon: true },
  { key: 'arabic_rtl', label: 'Arabic RTL Interface', desc: 'Right-to-left layout for Arabic language', comingSoon: true },
  { key: 'light_theme', label: 'Light Theme', desc: 'Allow users to switch to light mode', comingSoon: true },
  { key: 'auto_scheduling', label: 'Auto-Scheduling Engine', desc: 'Automatically assign proctors to sessions', comingSoon: true },
]

const AUDIT_EVENT_TYPES = ['', 'LOGIN', 'REPORT_PUBLISHED', 'COMPANY_CREATED', 'USER_CREATED', 'QUESTION_MODIFIED', 'SESSION_TERMINATED', 'SETTINGS_CHANGED']

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'flags' | 'legal' | 'audit'>('general')
  const [values, setValues] = useState<Record<string, any>>({})
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [terms, setTerms] = useState('')
  const [privacy, setPrivacy] = useState('')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditEventType, setAuditEventType] = useState('')
  const [auditPage, setAuditPage] = useState(1)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => adminApi.getSettings().then(r => r.data),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-log', auditSearch, auditEventType, auditPage],
    queryFn: () => adminApi.getAuditLog({ search: auditSearch || undefined, eventType: auditEventType || undefined, page: auditPage, limit: 25 }).then(r => r.data),
    enabled: activeTab === 'audit',
  })

  useEffect(() => {
    if (settings) {
      setValues(settings)
      // Extract feature flags from settings
      const f: Record<string, boolean> = {}
      FEATURE_FLAGS.forEach(ff => { f[ff.key] = settings[ff.key] ?? false })
      setFlags(f)
      // Legal content lives in the same settings map
      setTerms(typeof settings.terms_and_conditions === 'string' ? settings.terms_and_conditions : '')
      setPrivacy(typeof settings.privacy_policy === 'string' ? settings.privacy_policy : '')
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(values)) {
        await adminApi.updateSetting(key, value)
      }
      for (const [key, value] of Object.entries(flags)) {
        await adminApi.updateSetting(key, value)
      }
    },
    onSuccess: () => toast.success('Settings saved'),
    onError: () => toast.error('Failed to save settings'),
  })

  const legalSaveMutation = useMutation({
    mutationFn: async () => {
      await adminApi.updateSetting('terms_and_conditions', terms)
      await adminApi.updateSetting('privacy_policy', privacy)
    },
    onSuccess: () => toast.success('Legal content published — candidates will see the new version on their next OTP screen'),
    onError: () => toast.error('Failed to publish legal content'),
  })

  const auditLogs: any[] = auditData?.logs || auditData || []
  const auditTotal: number = auditData?.total || 0

  if (isLoading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading settings...</div>

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Platform Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Global configuration for all platform behaviour</p>
        </div>
        {activeTab !== 'audit' && activeTab !== 'legal' && (
          <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={15} /> {saveMutation.isPending ? 'Saving...' : 'Save All'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        {[['general', 'General Settings'], ['flags', 'Feature Flags'], ['legal', 'Legal Content'], ['audit', 'Audit Log']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === tab ? '600' : '400', color: activeTab === tab ? 'var(--cyan)' : 'var(--text-muted)', borderBottom: activeTab === tab ? '2px solid var(--cyan)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(SETTING_LABELS).map(([key, meta]) => (
            <div key={key} className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{meta.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{meta.desc}</p>
              </div>
              <input className="form-input" type={meta.type} style={{ width: '120px', textAlign: 'center' }}
                value={values[key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [key]: meta.type === 'number' ? parseFloat(e.target.value) : e.target.value }))} />
            </div>
          ))}
        </div>
      )}

      {/* FEATURE FLAGS */}
      {activeTab === 'flags' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {FEATURE_FLAGS.map(ff => (
            <div key={ff.key} className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: ff.comingSoon ? 0.55 : 1 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{ff.label}</p>
                  {ff.comingSoon && (
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--amber)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 6px', borderRadius: '4px' }}>Coming Soon</span>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{ff.desc}</p>
              </div>
              <button type="button"
                disabled={ff.comingSoon}
                onClick={() => { if (!ff.comingSoon) setFlags(f => ({ ...f, [ff.key]: !f[ff.key] })) }}
                title={ff.comingSoon ? 'Not available yet' : undefined}
                style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: ff.comingSoon ? 'not-allowed' : 'pointer', background: flags[ff.key] ? 'var(--emerald)' : 'var(--bg-elevated)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '3px', left: flags[ff.key] ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* LEGAL CONTENT */}
      {activeTab === 'legal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Terms & Conditions</p>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{terms.length} chars</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Shown to candidates on the OTP verification screen. Plain text or simple HTML — basic tags only (p, b, ul, li, a, br).
            </p>
            <textarea
              className="form-input"
              value={terms}
              onChange={e => setTerms(e.target.value)}
              rows={14}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical', lineHeight: '1.6' }}
              placeholder="Paste your full Terms & Conditions here..."
            />
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Privacy Policy</p>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{privacy.length} chars</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Linked from the OTP screen and the candidate's exam page. Same formatting rules as above.
            </p>
            <textarea
              className="form-input"
              value={privacy}
              onChange={e => setPrivacy(e.target.value)}
              rows={14}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical', lineHeight: '1.6' }}
              placeholder="Paste your full Privacy Policy here..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="btn-primary"
              onClick={() => legalSaveMutation.mutate()}
              disabled={legalSaveMutation.isPending || (!terms.trim() && !privacy.trim())}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
              <Save size={15} /> {legalSaveMutation.isPending ? 'Publishing...' : 'Publish Legal Content'}
            </button>
          </div>

          <div style={{ padding: '12px 14px', background: 'rgba(0,212,255,0.06)', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.2)', fontSize: '12px', color: 'var(--cyan)', lineHeight: '1.6' }}>
            Candidates must tick a checkbox confirming they have read these documents before they can verify their OTP and start the exam.
            The latest published version is fetched live — there is no caching.
          </div>
        </div>
      )}

      {/* AUDIT LOG */}
      {activeTab === 'audit' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Search by user or event..." value={auditSearch} onChange={e => { setAuditSearch(e.target.value); setAuditPage(1) }} style={{ paddingLeft: '32px' }} />
            </div>
            <select className="form-input" style={{ width: '200px' }} value={auditEventType} onChange={e => { setAuditEventType(e.target.value); setAuditPage(1) }}>
              {AUDIT_EVENT_TYPES.map(t => <option key={t} value={t}>{t || 'All Event Types'}</option>)}
            </select>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr><th>Timestamp</th><th>User</th><th>Event</th><th>Target</th><th>IP</th><th style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={12} /> Hash</th></tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
                ) : !auditLogs.length ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No audit logs found.</td></tr>
                ) : auditLogs.map((log: any, i: number) => (
                  <tr key={log.id || i}>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      <div>{log.user?.firstName} {log.user?.lastName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{log.user?.role?.replace(/_/g, ' ')}</div>
                    </td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,212,255,0.1)', color: 'var(--cyan)', fontSize: '11px', fontWeight: '600' }}>
                        {log.eventType || log.event || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.targetId || log.target || '—'}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.ipAddress || '—'}</td>
                    <td style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.hash ? log.hash.slice(0, 12) + '...' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {auditTotal > 25 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button className="btn-ghost" disabled={auditPage === 1} onClick={() => setAuditPage(p => p - 1)} style={{ padding: '6px 14px', fontSize: '13px' }}>← Prev</button>
              <span style={{ padding: '6px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>Page {auditPage} of {Math.ceil(auditTotal / 25)}</span>
              <button className="btn-ghost" disabled={auditPage >= Math.ceil(auditTotal / 25)} onClick={() => setAuditPage(p => p + 1)} style={{ padding: '6px 14px', fontSize: '13px' }}>Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
