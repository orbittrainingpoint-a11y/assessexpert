'use client'
import { useState, useRef, useEffect } from 'react'
import { User, VideoOff } from 'lucide-react'
import ChecklistPanel from './ChecklistPanel'

interface Candidate {
  id: string
  name: string
  stream: MediaStream | null
  socketId?: string
  verified?: boolean
}

interface Props {
  sessionId: string
  candidates: Candidate[]
  proctorStream: MediaStream | null
  onCandidateSelect: (candidateId: string, socketId?: string) => void
  onAllVerifiedClick: () => void
  allVerified: boolean
}

function VideoBox({ stream, label, muted = true, style }: { stream: MediaStream | null; label: string; muted?: boolean; style?: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    if (stream) ref.current.play().catch(() => {})
  }, [stream])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', ...style }}>
      {stream ? (
        <video ref={ref} autoPlay muted={muted} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <User size={32} color="var(--text-muted)" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '0 8px' }}>{label}</span>
        </div>
      )}
    </div>
  )
}

export default function VerificationLayout({ sessionId, candidates, proctorStream, onCandidateSelect, onAllVerifiedClick, allVerified }: Props) {
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(candidates[0]?.id || null)
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set())

  const activeCandidate = candidates.find(c => c.id === activeCandidateId)

  const handleSelect = (id: string, socketId?: string) => {
    setActiveCandidateId(id)
    onCandidateSelect(id, socketId)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '65fr 15fr 20fr', gap: '12px', height: 'calc(100vh - 160px)', minHeight: '600px' }}>

      {/* ── LEFT 65%: Main Active Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
        {/* Active candidate large view */}
        <div className="glass-card" style={{ flex: 1, padding: '12px', position: 'relative', border: '2px solid var(--amber)', minHeight: 0 }}>
          <div style={{ position: 'absolute', top: '12px', left: '16px', zIndex: 10, background: 'rgba(0,0,0,0.75)', padding: '5px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
              {activeCandidate ? `Active Verifying: ${activeCandidate.name}` : 'Click a candidate tile to begin verification'}
            </span>
          </div>
          <div style={{ width: '100%', height: '100%' }}>
            <VideoBox stream={activeCandidate?.stream || null} label="No candidate selected — click a tile on the right" />
          </div>
        </div>

        {/* Proctor self camera — bottom left */}
        <div style={{ width: '200px', flexShrink: 0 }}>
          <div className="glass-card" style={{ padding: '8px', border: '2px solid var(--amber)', background: 'rgba(215,119,6,0.08)' }}>
            <div style={{ height: '112px', position: 'relative' }}>
              <VideoBox stream={proctorStream} label="Camera starting..." />
              <div style={{ position: 'absolute', bottom: '4px', left: '6px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', color: 'var(--amber)', fontWeight: '600' }}>
                YOU (PROCTOR)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE 15%: Candidate List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
        <div className="glass-card" style={{ flex: 1, padding: '10px', overflowY: 'auto', minHeight: 0 }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Candidates
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {candidates.map((c, i) => {
              const isActive = c.id === activeCandidateId
              const isDone = verifiedIds.has(c.id)
              return (
                <div key={c.id} onClick={() => handleSelect(c.id, c.socketId)}
                  style={{ borderRadius: '8px', border: `2px solid ${isActive ? 'var(--amber)' : isDone ? 'var(--emerald)' : 'var(--border)'}`, background: isActive ? 'rgba(215,119,6,0.08)' : 'var(--bg-elevated)', cursor: 'pointer', overflow: 'hidden', transition: 'all 0.15s' }}>
                  <div style={{ height: '70px', position: 'relative' }}>
                    <VideoBox stream={c.stream} label={`Candidate ${i + 1}`} />
                    {isActive && (
                      <div style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
                    )}
                  </div>
                  <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>{c.name}</span>
                    <span style={{ fontSize: '10px', color: isDone ? 'var(--emerald)' : isActive ? 'var(--amber)' : 'var(--text-muted)', fontWeight: '600' }}>
                      {isDone ? '✔ Done' : isActive ? '◉ Active' : '● Pending'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Verification Done button */}
        <button onClick={onAllVerifiedClick} disabled={!allVerified} className="btn-primary"
          style={{ width: '100%', padding: '12px 8px', fontSize: '12px', fontWeight: '700', opacity: allVerified ? 1 : 0.4, cursor: allVerified ? 'pointer' : 'not-allowed', lineHeight: '1.3' }}>
          {allVerified ? '✓ Verification Done\nStart Exam ►' : 'Verification\nDone Button'}
        </button>
      </div>

      {/* ── RIGHT 20%: Checklist Panel ── */}
      <div className="glass-card" style={{ padding: '14px', overflowY: 'auto', minHeight: 0 }}>
        <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {activeCandidateId ? `Checklist — ${activeCandidate?.name}` : 'Checklist Area'}
        </p>
        {activeCandidateId ? (
          <ChecklistPanel
            sessionId={sessionId}
            candidateVideoRef={{ current: null } as any}
            onAllDone={() => setVerifiedIds(prev => new Set(prev).add(activeCandidateId))}
          />
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6' }}>
            Select a candidate tile to begin verification and load their checklist.
          </p>
        )}
      </div>
    </div>
  )
}
