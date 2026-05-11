'use client'
import { useRef, useEffect, useState } from 'react'
import { VideoOff, Volume2, Monitor, Mic } from 'lucide-react'

interface ChecklistItem {
  key: string
  title?: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'active' | 'done' | 'pending'
}

interface Props {
  sessionId: string
  candidateId: string
  examTitle: string
  proctorStream: MediaStream | null
  candidateStream: MediaStream | null
  checklist: ChecklistItem[]
  proctorActive: boolean
  onRequestScreenShare?: () => void
  screenShareRequested?: boolean
}

function VideoPanel({
  stream,
  label,
  muted,
  badge,
}: {
  stream: MediaStream | null
  label: string
  muted: boolean
  badge?: React.ReactNode
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    if (stream) ref.current.play().catch(() => {})
  }, [stream])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {badge}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: '200px', background: '#000', borderRadius: '10px', overflow: 'hidden', border: `2px solid ${stream ? 'var(--cyan)' : 'var(--border)'}` }}>
        {stream ? (
          <video ref={ref} autoPlay muted={muted} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <VideoOff size={36} color="var(--text-muted)" />
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', maxWidth: '200px', lineHeight: '1.5', margin: 0 }}>
              {label === 'Proctor' ? 'Waiting for proctor to connect...' : 'Camera not available'}
            </p>
          </div>
        )}
        {stream && (
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--emerald)', boxShadow: '0 0 6px var(--emerald)' }} />
            <span style={{ fontSize: '10px', color: '#fff', fontWeight: '600' }}>LIVE</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CandidateVerificationLayout({
  examTitle,
  proctorStream,
  candidateStream,
  checklist,
  proctorActive,
  onRequestScreenShare,
  screenShareRequested,
}: Props) {
  const normalizedChecklist = checklist.map(i => ({
    ...i,
    status: (i.status === 'done' ? 'COMPLETED' : i.status === 'active' ? 'IN_PROGRESS' : i.status === 'pending' ? 'PENDING' : i.status) as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
  }))

  const completed = normalizedChecklist.filter(i => i.status === 'COMPLETED').length
  const total = normalizedChecklist.length || 7
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--cyan)' }}>assessexpert</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>|</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{examTitle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--cyan)', fontWeight: '600' }}>Phase: Verification</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--rose)', boxShadow: '0 0 8px var(--rose)' }} />
            <span style={{ fontSize: '11px', color: 'var(--rose)', fontWeight: '600' }}>CAMERA ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Screen share request banner */}
      {screenShareRequested && onRequestScreenShare && (
        <div style={{ background: 'rgba(215,119,6,0.15)', border: '1px solid var(--amber)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Monitor size={18} color="var(--amber)" />
            <span style={{ fontSize: '13px', color: 'var(--amber)', fontWeight: '600' }}>
              Your proctor is requesting screen share access
            </span>
          </div>
          <button
            onClick={onRequestScreenShare}
            className="btn-primary"
            style={{ padding: '8px 20px', fontSize: '13px', background: 'var(--amber)', borderColor: 'var(--amber)' }}
          >
            Share My Screen
          </button>
        </div>
      )}

      {/* Main: 50/50 split video */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', flex: 1, minHeight: 0 }}>
        <VideoPanel
          stream={proctorStream}
          label="Proctor"
          muted={false}
          badge={
            proctorStream ? (
              <span style={{ fontSize: '11px', color: 'var(--emerald)', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Volume2 size={11} /> Connected
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: '4px' }}>
                Waiting...
              </span>
            )
          }
        />
        <VideoPanel
          stream={candidateStream}
          label="You"
          muted={true}
          badge={
            <span style={{ fontSize: '11px', color: 'var(--cyan)', background: 'rgba(0,212,255,0.1)', padding: '3px 8px', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Mic size={11} /> Camera & Mic Active
            </span>
          }
        />
      </div>

      {/* Bottom: Checklist progress */}
      <div className="glass-card" style={{ margin: '0 16px 16px', padding: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Verification Progress
          </span>
          <span style={{ fontSize: '12px', color: pct === 100 ? 'var(--emerald)' : 'var(--text-secondary)' }}>
            {completed} / {total} complete
          </span>
        </div>
        <div style={{ height: '5px', background: 'var(--bg-elevated)', borderRadius: '3px', marginBottom: '12px' }}>
          <div style={{ height: '100%', background: pct === 100 ? 'var(--emerald)' : 'var(--cyan)', borderRadius: '3px', width: `${pct}%`, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
          {normalizedChecklist.length > 0 ? normalizedChecklist.map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: item.status === 'COMPLETED' ? 'rgba(16,185,129,0.08)' : item.status === 'IN_PROGRESS' ? 'rgba(0,212,255,0.06)' : 'var(--bg-elevated)', borderRadius: '6px', border: `1px solid ${item.status === 'COMPLETED' ? 'rgba(16,185,129,0.3)' : item.status === 'IN_PROGRESS' ? 'rgba(0,212,255,0.3)' : 'transparent'}`, transition: 'all 0.3s' }}>
              <span style={{ fontSize: '13px', flexShrink: 0 }}>
                {item.status === 'COMPLETED' ? '✅' : item.status === 'IN_PROGRESS' ? '🔄' : '⬜'}
              </span>
              <span style={{ fontSize: '12px', color: item.status === 'COMPLETED' ? 'var(--emerald)' : item.status === 'IN_PROGRESS' ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: item.status !== 'PENDING' ? '600' : '400' }}>
                {item.title || item.key.replace(/ITEM_\d+_/, '').replace(/_/g, ' ')}
              </span>
            </div>
          )) : (
            ['Camera Verified', 'Identity Confirmed', 'ID Check', 'Room Scan', 'No Materials', 'Screen Share', 'Guidelines Agreed'].map(label => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <span style={{ fontSize: '13px' }}>⬜</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))
          )}
        </div>
        {pct === 100 && (
          <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '6px', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--emerald)' }}>✓ Verification Complete — Waiting for exam to begin...</span>
          </div>
        )}
      </div>
    </div>
  )
}
