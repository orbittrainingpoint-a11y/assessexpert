'use client'
import { useAuthStore } from '@/store/auth.store'
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'
import axios from 'axios'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']

const NOTIF_EVENTS = [
  { key: 'session_assigned', label: 'New session assigned' },
  { key: 'session_reminder', label: 'Session reminder (1h before)' },
  { key: 'report_ready', label: 'AI draft report ready' },
  { key: 'candidate_noshow', label: 'Candidate no-show' },
]

// Helper to convert day name to number (0=Mon, 6=Sun)
const dayToNumber = (day: string): number => DAYS.indexOf(day)

// Helper to convert number to day name
const numberToDay = (num: number): string => DAYS[num] || 'Mon'

export default function ProctorSettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'availability' | 'notifications' | 'security'>('profile')
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')

  // Availability grid: Set<"Mon-08:00">
  const [available, setAvailable] = useState<Set<string>>(new Set())
  const [maxPerDay, setMaxPerDay] = useState(4)
  const [timezone, setTimezone] = useState('Asia/Dubai')

  const [notifPrefs, setNotifPrefs] = useState<Record<string, { email: boolean; portal: boolean; sms: boolean }>>(() =>
    Object.fromEntries(NOTIF_EVENTS.map(e => [e.key, { email: true, portal: true, sms: e.key === 'session_reminder' }]))
  )

  // Load availability from backend
  const { data: availabilityData, refetch: refetchAvailability } = useQuery({
    queryKey: ['availability', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/availability`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      })
      return res.data
    },
    enabled: !!user?.id,
  })

  // Load availability data into state
  useEffect(() => {
    if (availabilityData) {
      // Convert slots to Set<"Day-Time">
      const slotsSet = new Set<string>()
      availabilityData.slots?.forEach((slot: any) => {
        const day = numberToDay(slot.dayOfWeek)
        // Parse time range and add all hours
        const startHour = parseInt(slot.startTime.split(':')[0])
        const endHour = parseInt(slot.endTime.split(':')[0])
        for (let hour = startHour; hour < endHour; hour++) {
          const timeStr = `${hour.toString().padStart(2, '0')}:00`
          slotsSet.add(`${day}-${timeStr}`)
        }
      })
      setAvailable(slotsSet)
      setTimezone(availabilityData.timezone || 'Asia/Dubai')
      setMaxPerDay(availabilityData.maxSessionsPerDay || 4)
    }
  }, [availabilityData])

  const changePwMutation = useMutation({
    mutationFn: () => authApi.changePassword(current, newPw),
    onSuccess: () => { toast.success('Password changed'); setCurrent(''); setNewPw(''); setConfirm('') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const saveAvailabilityMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not found')
      
      // Convert Set<"Day-Time"> to slots array
      const slotsMap = new Map<string, { start: number; end: number }>()
      
      available.forEach(key => {
        const [day, time] = key.split('-')
        const hour = parseInt(time.split(':')[0])
        const dayNum = dayToNumber(day)
        
        if (!slotsMap.has(day)) {
          slotsMap.set(day, { start: hour, end: hour + 1 })
        } else {
          const slot = slotsMap.get(day)!
          slot.start = Math.min(slot.start, hour)
          slot.end = Math.max(slot.end, hour + 1)
        }
      })
      
      const slots = Array.from(slotsMap.entries()).map(([day, { start, end }]) => ({
        dayOfWeek: dayToNumber(day),
        startTime: `${start.toString().padStart(2, '0')}:00`,
        endTime: `${end.toString().padStart(2, '0')}:00`,
      }))
      
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/availability`,
        { slots, timezone, maxSessionsPerDay: maxPerDay },
        { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } }
      )
    },
    onSuccess: () => {
      toast.success('Availability saved successfully')
      refetchAvailability()
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Failed to save availability')
    },
  })

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirm) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8) { toast.error('Minimum 8 characters'); return }
    changePwMutation.mutate()
  }

  const toggleSlot = (day: string, slot: string) => {
    const key = `${day}-${slot}`
    setAvailable(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'availability', label: 'Availability' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
  ] as const

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Your account and availability preferences</p>
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
              ['MFA Status', user?.mfaEnabled ? '✅ Enabled' : '⚠️ Not enabled'],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AVAILABILITY */}
      {activeTab === 'availability' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Weekly Availability</h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(5,150,105,0.4)', border: '1px solid rgba(5,150,105,0.6)' }} />
                  Available
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} />
                  Unavailable
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'left', width: '60px' }}>Time</th>
                    {DAYS.map(d => (
                      <th key={d} style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: '600' }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map(slot => (
                    <tr key={slot}>
                      <td style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{slot}</td>
                      {DAYS.map(day => {
                        const key = `${day}-${slot}`
                        const isAvail = available.has(key)
                        return (
                          <td key={day} style={{ padding: '3px 4px', textAlign: 'center' }}>
                            <button onClick={() => toggleSlot(day, slot)}
                              style={{ width: '100%', height: '24px', borderRadius: '4px', border: `1px solid ${isAvail ? 'rgba(5,150,105,0.5)' : 'var(--border)'}`, background: isAvail ? 'rgba(5,150,105,0.25)' : 'var(--bg-elevated)', cursor: 'pointer', transition: 'all 0.1s' }}
                              title={`${day} ${slot} — ${isAvail ? 'Available' : 'Unavailable'}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Click any slot to toggle availability. The scheduling engine uses this to assign sessions.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Preferences</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Working Timezone</label>
                <select className="form-input" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {['Asia/Dubai', 'Asia/Riyadh', 'Asia/Karachi', 'Europe/London', 'America/New_York', 'Asia/Kolkata'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Max Sessions Per Day</label>
                <input className="form-input" type="number" min={1} max={10} value={maxPerDay}
                  onChange={e => setMaxPerDay(parseInt(e.target.value))} />
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: '16px', padding: '8px 20px', fontSize: '13px' }}
              onClick={() => saveAvailabilityMutation.mutate()}
              disabled={saveAvailabilityMutation.isPending}>
              {saveAvailabilityMutation.isPending ? 'Saving...' : 'Save Availability'}
            </button>
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
          <div style={{ marginTop: '24px', padding: '14px', background: 'rgba(215,119,6,0.08)', borderRadius: '8px', border: '1px solid rgba(215,119,6,0.2)' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--amber)', fontWeight: '600' }}>MFA is mandatory for Proctors</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Multi-factor authentication cannot be disabled for this role. Status: {user?.mfaEnabled ? '✅ Active' : '⚠️ Not configured — contact Admin'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
