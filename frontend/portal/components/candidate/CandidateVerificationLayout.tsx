'use client'
import { useRef, useEffect } from 'react'
import { VideoOff, Volume2 } from 'lucide-react'

interface ChecklistItem {
  key: string
  title?: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
}

interface Props {
  sessionId: string
  candidateId: string
  examTitle: string
  proctorStream: MediaStream | null
  candidateStream: MediaStream | null
  checklist: ChecklistItem[]
  proctorActive: boolean
}

function VideoPanel({ stream, label, muted, active, badge }: { stream: MediaStream | null; label: string; muted: boolean; active: boolean; badge?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    if (stream) ref.current.play().catch(() => {})
  }, [stream])

  return (
    <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {badge}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: '280px', background: '#000', borderRadius: '8px', overflow: 'hidden', border: `2px solid ${active ? 'var(--cyan)' : 'var(--border)'}` }}>
        {stream ? (
          <video ref={ref} autoPlay muted={muted} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <VideoOff size={40} color="var(--text-muted)" />
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', maxWidth: '220px', lineHeight: '1.5' }}>
              {label === 'Proctor Camera'
                ? 'Waiting for proctor to connect...'
                : 'Camera not available'}
            </p>
          </div>
        )}
        {active && stream && (
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--emerald)', boxShadow: '0 0 6px var(--emerald)' }} />
            <span style={{ fontSize: '10px', color: '#fff', fontWeight: '600' }}>LIVE</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CandidateVerificationLayout({ examTitle, proctorStream, candidateStream, checklist, proctorActive }: Props) {
  const completed = checklist.filter(i => i.status === 'COMPLETED').length
  const total = checklist.length || 7
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Candidate Screen</span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 8px' }}>|</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{examTitle}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 8px' }}>|</span>
          <span style={{ fontSize: '13px', color: 'var(--cyan)', fontWeight: '600' }}>Phase: Verification</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', boxShadow: '0 0 8px var(--rose)' }} />
          <span style={{ fontSize: '12px', color: 'var(--rose)', fontWeight: '600' }}>CAMERA ACTIVE</span>
        </div>
      </div>

      {/* Main: 50/50 video panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', flex: 1 }}>
        {/* Proctor Camera */}
        <VideoPanel
          stream={proctorStream}
          label="Proctor Camera"
          muted={false}
          active={proctorActive}
          badge={proctorActive ? (
            <span style={{ fontSize: '11px', color: 'var(--emerald)', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Volume2 size={11} /> ACTIVE
            </span>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: '4px' }}>
              Waiting...
            </span>
          )}
        />

        {/* Candidate Camera */}
        <VideoPanel
          stream={candidateStream}
          label="Your Camera"
          muted={true}
          active={true}
          badge={
            <span style={{ fontSize: '11px', color: 'var(--cyan)', background: 'rgba(0,212,255,0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: '600' }}>
              ● Camera Active
            </span>
          }
        />
      </div>

      {/* Bottom: Checklist progress */}
      <div className="glass-card" style={{ margin: '0 16px 16px', padding: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Verification Checklist Status
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Progress: {completed} of {total} items verified
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', marginBottom: '14px' }}>
          <div style={{ height: '100%', background: pct === 100 ? 'var(--emerald)' : 'var(--cyan)', borderRadius: '3px', width: `${pct}%`, transition: 'width 0.4s ease' }} />
        </div>

        {/* Checklist items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
          {checklist.length > 0 ? checklist.map((item, idx) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: item.status === 'COMPLETED' ? 'rgba(16,185,129,0.08)' : item.status === 'IN_PROGRESS' ? 'rgba(0,212,255,0.06)' : 'var(--bg-elevated)', borderRadius: '6px', border: `1px solid ${item.status === 'COMPLETED' ? 'var(--emerald)' : item.status === 'IN_PROGRESS' ? 'var(--cyan)' : 'transparent'}`, transition: 'all 0.3s' }}>
              <span style={{ fontSize: '14px' }}>
                {item.status === 'COMPLETED' ? '☑' : '☐'}
              </span>
              <span style={{ fontSize: '12px', color: item.status === 'COMPLETED' ? 'var(--emerald)' : item.status === 'IN_PROGRESS' ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: item.status === 'COMPLETED' ? '600' : '400' }}>
                {item.title || item.key.replace(/ITEM_\d+_/, '').replace(/_/g, ' ')}
              </span>
              {item.status === 'PENDING' && (
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>pending</span>
              )}
            </div>
          )) : (
            // Placeholder items while loading
            ['ID Verified', 'Face Match Confirmed', 'Room Scan Done', 'No Phone on Desk', 'No Notes Visible', 'Lighting Adequate', 'Single Monitor Only'].map(label => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <span style={{ fontSize: '14px' }}>☐</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>pending</span>
              </div>
            ))
          )}
        </div>

        {pct === 100 && (
          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '6px', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--emerald)' }}>✓ Verification Complete — Waiting for exam to begin...</span>
          </div>
        )}
      </div>
    </div>
  )
}
