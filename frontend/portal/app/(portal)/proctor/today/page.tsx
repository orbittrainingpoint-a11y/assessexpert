'use client'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi } from '@/lib/api'
import Link from 'next/link'
import { Calendar, Clock, Zap, Bell } from 'lucide-react'

const DEMO_SESSION_TOKEN = 'DEMO-AHMED-2026-ACAD-L1-TOKEN'

function getTimeGroup(date: Date): 'morning' | 'afternoon' | 'evening' | 'other' {
  const h = date.getHours()
  if (h >= 8 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 20) return 'evening'
  return 'other'
}

function getJoinState(scheduledAt: string, status: string): 'too-early' | 'active' | 'now' | 'live' | 'done' {
  const live = ['WAITING_ROOM', 'CHECKLIST', 'MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS']
  const done = ['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'CANCELLED', 'NO_SHOW']
  if (live.includes(status)) return 'live'
  if (done.includes(status)) return 'done'
  const diff = (new Date(scheduledAt).getTime() - Date.now()) / 60000
  if (diff > 15) return 'too-early'
  if (diff > 0) return 'active'
  return 'now'
}

export default function ProctorTodayPage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['proctor-today'],
    queryFn: () => sessionsApi.getToday().then(r => r.data),
    refetchInterval: 15000,
  })

  // Poll for demo session specifically — check if candidate is waiting
  const { data: demoData } = useQuery({
    queryKey: ['demo-session'],
    queryFn: async () => {
      try {
        const r = await sessionsApi.getByToken(DEMO_SESSION_TOKEN)
        return r.data || null
      } catch { return null }
    },
    refetchInterval: 5000,
  })

  const list: any[] = sessions?.sessions || sessions || []
  const demoSession = demoData

  // Is candidate currently in waiting room?
  const candidateWaiting = demoSession && ['WAITING_ROOM', 'CHECKLIST'].includes(demoSession.status)
  const demoLive = demoSession && ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'].includes(demoSession.status)

  const groups = {
    morning:   list.filter(s => getTimeGroup(new Date(s.scheduledAt)) === 'morning'),
    afternoon: list.filter(s => getTimeGroup(new Date(s.scheduledAt)) === 'afternoon'),
    evening:   list.filter(s => getTimeGroup(new Date(s.scheduledAt)) === 'evening'),
    other:     list.filter(s => getTimeGroup(new Date(s.scheduledAt)) === 'other'),
  }

  const SessionCard = ({ s }: { s: any }) => {
    const joinState = getJoinState(s.scheduledAt, s.status)
    const scheduledTime = new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const opensAt = new Date(new Date(s.scheduledAt).getTime() - 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg-surface)', border: `1px solid ${joinState === 'live' ? 'rgba(225,29,72,0.3)' : joinState === 'now' || joinState === 'active' ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`, borderRadius: '10px', borderLeft: `3px solid ${joinState === 'live' ? 'var(--rose)' : joinState === 'now' || joinState === 'active' ? 'var(--cyan)' : joinState === 'done' ? 'var(--emerald)' : 'var(--border)'}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {s.candidate?.firstName} {s.candidate?.lastName}
            </span>
            <span className={`badge ${joinState === 'live' ? 'badge-live' : joinState === 'done' ? (s.status === 'REPORT_PUBLISHED' ? 'badge-pass' : 'badge-pending') : 'badge-pending'}`} style={{ fontSize: '11px' }}>
              {s.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {scheduledTime}</span>
            <span>{s.assessmentType?.name}</span>
            {s.organization?.name && <span>· {s.organization.name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {joinState === 'too-early' && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 14px', border: '1px solid var(--border)', borderRadius: '8px' }}>
              Opens at {opensAt}
            </span>
          )}
          {joinState === 'active' && (
            <Link href={`/proctor/session?id=${s.id}`} className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px', textDecoration: 'none', boxShadow: '0 0 12px rgba(0,212,255,0.3)' }}>
              Join at {opensAt} →
            </Link>
          )}
          {joinState === 'now' && (
            <Link href={`/proctor/session?id=${s.id}`} className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px', textDecoration: 'none', boxShadow: '0 0 16px rgba(0,212,255,0.5)' }}>
              Join Now →
            </Link>
          )}
          {joinState === 'live' && (
            <Link href={`/proctor/session?id=${s.id}`} className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px', textDecoration: 'none', background: 'var(--rose)', borderColor: 'var(--rose)' }}>
              Rejoin →
            </Link>
          )}
          {joinState === 'done' && s.status === 'PENDING_PROCTOR_REVIEW' && (
            <Link href={`/proctor/reports/${s.id}`} className="btn-ghost"
              style={{ padding: '8px 14px', fontSize: '13px', textDecoration: 'none', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}>
              Review Report →
            </Link>
          )}
          {joinState === 'done' && s.status === 'REPORT_PUBLISHED' && (
            <span style={{ fontSize: '12px', color: 'var(--emerald)' }}>✓ Complete</span>
          )}
        </div>
      </div>
    )
  }

  const TimeGroup = ({ title, emoji, items }: { title: string; emoji: string; items: any[] }) => {
    if (!items.length) return null
    return (
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '16px' }}>{emoji}</span>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({items.length})</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(s => <SessionCard key={s.id} s={s} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Today's Assessments</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={13} />
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          <span style={{ marginLeft: '8px' }}>· {list.length} session{list.length !== 1 ? 's' : ''} today</span>
        </p>
      </div>

      {/* ── DEMO SESSION BANNER ── */}
      <div style={{ marginBottom: '28px' }}>
        {/* Candidate waiting notification */}
        {candidateWaiting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.4)', borderRadius: '8px', marginBottom: '12px', animation: 'pulse 2s infinite' }}>
            <Bell size={16} color="var(--rose)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--rose)' }}>
                🔴 Candidate is in the Waiting Room!
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Ahmed Al-Rashidi has joined and is waiting for you to start the session.
              </p>
            </div>
            <Link href={`/proctor/session?id=${demoSession.id}`} className="btn-primary"
              style={{ textDecoration: 'none', padding: '8px 16px', fontSize: '13px', background: 'var(--rose)', borderColor: 'var(--rose)', flexShrink: 0 }}>
              Join Now →
            </Link>
          </div>
        )}

        {/* Demo session card */}
        <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '12px', borderLeft: '4px solid var(--cyan)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Zap size={16} color="var(--cyan)" />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Demo Session
            </h3>
            <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(0,212,255,0.1)', fontSize: '11px', color: 'var(--cyan)' }}>
              Always available
            </span>
            {demoSession && (
              <span className={`badge ${demoLive ? 'badge-live' : candidateWaiting ? 'badge-live' : 'badge-pending'}`} style={{ fontSize: '11px', marginLeft: 'auto' }}>
                {demoSession.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Candidate', value: 'Ahmed Al-Rashidi' },
              { label: 'Email', value: 'ahmed.alrashidi@example.com' },
              { label: 'Assessment', value: demoSession?.assessmentType?.name || 'CAD Drafter (ACAD-L1)' },
              { label: 'Company', value: demoSession?.organization?.name || 'Demo Engineering Company' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{label}</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Step-by-step demo instructions */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '14px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How to run the demo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { step: '1', text: 'Open candidate link in another browser/tab (incognito)', link: `/exam?token=${DEMO_SESSION_TOKEN}`, linkLabel: 'Open Candidate →' },
                { step: '2', text: 'Candidate: enter email → click 000000 bypass → verify → enter waiting room', link: null, linkLabel: null },
                { step: '3', text: 'Come back here and click "Join Session" below', link: null, linkLabel: null },
                { step: '4', text: 'Complete the 10-item checklist → Begin MCQ', link: null, linkLabel: null },
              ].map(({ step, text, link, linkLabel }) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--cyan)', flexShrink: 0 }}>
                    {step}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{text}</span>
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer"
                      style={{ fontSize: '11px', color: 'var(--cyan)', textDecoration: 'none', padding: '3px 8px', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '5px', flexShrink: 0 }}>
                      {linkLabel}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {demoSession ? (
              <Link
                href={`/proctor/session?id=${demoSession.id}`}
                className="btn-primary"
                style={{
                  flex: 1, textDecoration: 'none', textAlign: 'center', padding: '11px',
                  fontSize: '14px', fontWeight: '600',
                  ...(candidateWaiting || demoLive ? { background: 'var(--rose)', borderColor: 'var(--rose)', boxShadow: '0 0 16px rgba(225,29,72,0.4)' } : { boxShadow: '0 0 12px rgba(0,212,255,0.3)' })
                }}>
                {demoLive ? '🔴 Rejoin Live Session →' : candidateWaiting ? '🔴 Candidate Waiting — Join Now →' : '▶ Join Demo Session →'}
              </Link>
            ) : (
              <div style={{ flex: 1, padding: '11px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                Loading session...
              </div>
            )}
            <a
              href={`/exam?token=${DEMO_SESSION_TOKEN}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
              style={{ padding: '11px 16px', fontSize: '13px', textDecoration: 'none', color: 'var(--cyan)', borderColor: 'rgba(0,212,255,0.3)' }}>
              Open Candidate Tab ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── TODAY'S SESSIONS ── */}
      {isLoading ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>
      ) : !list.length ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '24px', marginBottom: '8px' }}>📅</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>No other sessions scheduled for today.</p>
        </div>
      ) : (
        <>
          <TimeGroup title="Morning" emoji="🌅" items={groups.morning} />
          <TimeGroup title="Afternoon" emoji="☀️" items={groups.afternoon} />
          <TimeGroup title="Evening" emoji="🌆" items={groups.evening} />
          <TimeGroup title="Other" emoji="🕐" items={groups.other} />
        </>
      )}
    </div>
  )
}
