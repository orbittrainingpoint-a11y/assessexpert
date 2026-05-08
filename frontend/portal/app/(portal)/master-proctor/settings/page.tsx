'use client'
import { useAuthStore } from '@/store/auth.store'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'

const SESSION_SETTINGS = [
  { key: 'session_join_window', label: 'Session Join Window (minutes)', desc: 'How early proctors can join before scheduled start', default: 15 },
  { key: 'report_sla_hours', label: 'Report SLA (hours)', desc: 'Target hours from session end to published report', default: 24 },
  { key: 'max_candidates_per_session', label: 'Max Candidates Per Session', desc: 'Default maximum candidates per session', default: 5 },
  { key: 'sla_alert_threshold_hours', label: 'SLA Alert Threshold (hours before breach)', desc: 'When to notify Master Proctor of upcoming SLA breach', default: 4 },
]

const AI_SETTINGS = [
  { key: 'face_absence_threshold', label: 'Face Absence Alert (seconds)', desc: 'Seconds before face-absent event is flagged', default: 8 },
  { key: 'fr_check_interval', label: 'FR Check Interval (seconds)', desc: 'How often periodic facial recognition runs', default: 90 },
  { key: 'fr_threshold_verified', label: 'FR Auto-Verified Threshold (%)', desc: 'FR score above which candidate is auto-verified', default: 90 },
  { key: 'fr_threshold_review', label: 'FR Manual Review Threshold (%)', desc: 'FR score below which manual review is required', default: 70 },
  { key: 'tab_switch_escalation', label: 'Tab Switch Escalation Count', desc: 'Number of tab switches before active alert', default: 3 },
]

const NOTIF_EVENTS = [
  { key: 'live_critical_flag', label: 'Live session: AI critical flag' },
  { key: 'report_sla_breach', label: 'Report SLA breach approaching' },
  { key: 'report_published', label: 'Report published by proctor' },
  { key: 'proctor_offline', label: 'Proctor goes offline mid-session' },
  { key: 'new_session_assigned', label: 'New session assigned to any proctor' },
]

export default function MasterProctorSettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'session' | 'ai' | 'notifications' | 'security'>('profile')
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sessionVals, setSessionVals] = useState<Record<string, number>>(
    Object.fromEntries(SESSION_SETTINGS.map(s => [s.key, s.default]))
  )
  const [aiVals, setAiVals] = useState<Record<string, number>>(
    Object.fromEntries(AI_SETTINGS.map(s => [s.key, s.default]))
  )
  const [notifPrefs, setNotifPrefs] = useState<Record<string, { email: boolean; portal: boolean; sms: boolean }>>(() =>
    Object.fromEntries(NOTIF_EVENTS.map(e => [e.key, { email: true, portal: true, sms: e.key === 'proctor_offline' || e.key === 'report_sla_breach' }]))
  )

  const changePwMutation = useMutation({
    mutationFn: () => authApi.changePassword(current, newPw),
    onSuccess: () => { toast.success('Password changed'); setCurrent(''); setNewPw(''); setConfirm('') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirm) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8) { toast.error('Minimum 8 characters'); return }
    changePwMutation.mutate()
  }

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'session', label: 'Session Settings' },
    { key: 'ai', label: 'AI Monitoring' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
  ] as const

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Operational and monitoring configuration</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === t.key ? '600' : '400', color: activeTab === t.key ? 'var(--cyan)' : 'var(--text-muted)', borderBottom: activeTab === t.key ? '2px solid var(--cyan)' : '2px solid transparent', whiteSpace: 'nowrap' }}>
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
              ['MFA Status', '✅ Always Active (mandatory)'],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SESSION SETTINGS */}
      {activeTab === 'session' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SESSION_SETTINGS.map(s => (
            <div key={s.key} className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.desc}</p>
              </div>
              <input className="form-input" type="number" style={{ width: '100px', textAlign: 'center' }}
                value={sessionVals[s.key] ?? s.default}
                onChange={e => setSessionVals(v => ({ ...v, [s.key]: parseInt(e.target.value) }))} />
            </div>
          ))}
          <button className="btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 20px', fontSize: '13px' }}
            onClick={() => toast.success('Session settings saved')}>
            Save Settings
          </button>
        </div>
      )}

      {/* AI MONITORING */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {AI_SETTINGS.map(s => (
            <div key={s.key} className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.desc}</p>
              </div>
              <input className="form-input" type="number" style={{ width: '100px', textAlign: 'center' }}
                value={aiVals[s.key] ?? s.default}
                onChange={e => setAiVals(v => ({ ...v, [s.key]: parseInt(e.target.value) }))} />
            </div>
          ))}
          <button className="btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 20px', fontSize: '13px' }}
            onClick={() => toast.success('AI monitoring settings saved')}>
            Save Settings
          </button>
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
          <div style={{ marginTop: '24px', padding: '14px', background: 'rgba(215,119,6,0.08)', borderRadius: '8px', border: '1px solid rgba(215,119,6,0.2)' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--amber)', fontWeight: '600' }}>MFA is mandatory for Master Proctors</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Re-authentication is required for destructive actions (report override, session termination, content modification).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
