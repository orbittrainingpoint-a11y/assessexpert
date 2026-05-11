'use client'
import { useState, useRef, useEffect } from 'react'
import { User, Mic, MicOff } from 'lucide-react'
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

function VideoBox({
  stream,
  label,
  muted = true,
  style,
}: {
  stream: MediaStream | null
  label: string
  muted?: boolean
  style?: React.CSSProperties
}) {
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
          <User size={28} color="var(--text-muted)" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '0 8px' }}>{label}</span>
        </div>
      )}
    </div>
  )
}

export default function VerificationLayout({
  sessionId,
  candidates,
  proctorStream,
  onCandidateSelect,
  onAllVerifiedClick,
  allVerified,
}: Props) {
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(candidates[0]?.id || null)
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set())

  // Auto-select first candidate
  useEffect(() => {
    if (!activeCandidateId && candidates.length > 0) {
      setActiveCandidateId(candidates[0].id)
      onCandidateSelect(candidates[0].id, candidates[0].socketId)
    }
  }, [candidates.length])

  const activeCandidate = candidates.find(c => c.id === activeCandidateId)

  const handleSelect = (id: string, socketId?: string) => {
    setActiveCandidateId(id)
    onCandidateSelect(id, socketId)
  }

  const allDone = candidates.length > 0 && candidates.every(c => verifiedIds.has(c.id))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 280px', gap: '12px', height: 'calc(100vh - 160px)', minHeight: '600px' }}>

      {/* ── LEFT: Active candidate large view + proctor PIP ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
        <div className="glass-card" style={{ flex: 1, padding: '10px', position: 'relative', border: '2px solid var(--amber)', minHeight: 0, overflow: 'hidden' }}>
          {/* Label */}
          <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 10, background: 'rgba(0,0,0,0.75)', padding: '4px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: activeCandidate?.stream ? 'var(--emerald)' : 'var(--rose)', boxShadow: activeCandidate?.stream ? '0 0 6px var(--emerald)' : 'none' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
              {activeCandidate ? `Verifying: ${activeCandidate.name}` : 'Select a candidate →'}
            </span>
          </div>

          {/* Audio indicator */}
          <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 10, background: 'rgba(0,0,0,0.75)', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mic size={12} color="var(--emerald)" />
            <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: '600' }}>AUDIO LIVE</span>
          </div>

          {/* Candidate stream — unmuted so proctor hears candidate */}
          <div style={{ width: '100%', height: '100%' }}>
            <VideoBox
              stream={activeCandidate?.stream || null}
              label="No candidate selected — click a tile"
              muted={false}
            />
          </div>

          {/* Proctor self PIP — bottom right */}
          <div style={{ position: 'absolute', bottom: '12px', right: '12px', width: '160px', aspectRatio: '16/9', zIndex: 10, borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--amber)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            <VideoBox stream={proctorStream} label="Your camera" muted={true} />
            <div style={{ position: 'absolute', bottom: '4px', left: '6px', background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: '3px', fontSize: '9px', color: 'var(--amber)', fontWeight: '700' }}>
              YOU (PROCTOR)
            </div>
            {proctorStream && (
              <div style={{ position: 'absolute', top: '4px', right: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Mic size={9} color="var(--emerald)" />
                <span style={{ fontSize: '8px', color: 'var(--emerald)', fontWeight: '700' }}>MIC ON</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Candidate tiles list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
        <div className="glass-card" style={{ flex: 1, padding: '10px', overflowY: 'auto', minHeight: 0 }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Candidates ({candidates.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {candidates.map((c, i) => {
              const isActive = c.id === activeCandidateId
              const isDone = verifiedIds.has(c.id)
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c.id, c.socketId)}
                  style={{
                    borderRadius: '8px',
                    border: `2px solid ${isActive ? 'var(--amber)' : isDone ? 'var(--emerald)' : 'var(--border)'}`,
                    background: isActive ? 'rgba(215,119,6,0.08)' : isDone ? 'rgba(16,185,129,0.05)' : 'var(--bg-elevated)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ height: '80px', position: 'relative' }}>
                    <VideoBox stream={c.stream} label={`Candidate ${i + 1}`} muted={true} />
                    {/* Live dot */}
                    {c.stream && (
                      <div style={{ position: 'absolute', top: '5px', right: '5px', width: '7px', height: '7px', borderRadius: '50%', background: isActive ? 'var(--amber)' : 'var(--emerald)', boxShadow: `0 0 5px ${isActive ? 'var(--amber)' : 'var(--emerald)'}` }} />
                    )}
                    {/* Audio icon on active */}
                    {isActive && (
                      <div style={{ position: 'absolute', bottom: '4px', left: '5px', background: 'rgba(0,0,0,0.7)', padding: '2px 5px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Mic size={9} color="var(--emerald)" />
                        <span style={{ fontSize: '8px', color: 'var(--emerald)' }}>LIVE</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>{c.name}</span>
                    <span style={{ fontSize: '10px', color: isDone ? 'var(--emerald)' : isActive ? 'var(--amber)' : 'var(--text-muted)', fontWeight: '600', flexShrink: 0 }}>
                      {isDone ? '✔ Done' : isActive ? '◉ Active' : '● Wait'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Start Exam button */}
        <button
          onClick={onAllVerifiedClick}
          disabled={!allVerified && !allDone}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '12px 8px',
            fontSize: '12px',
            fontWeight: '700',
            opacity: (allVerified || allDone) ? 1 : 0.4,
            cursor: (allVerified || allDone) ? 'pointer' : 'not-allowed',
          }}
        >
          {(allVerified || allDone) ? '✓ All Verified — Start Exam ►' : `Verify all ${candidates.length} candidate${candidates.length > 1 ? 's' : ''} first`}
        </button>
      </div>

      {/* ── RIGHT: Checklist ── */}
      <div className="glass-card" style={{ padding: '14px', overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          {activeCandidateId ? `Checklist — ${activeCandidate?.name?.split(' ')[0]}` : 'Checklist'}
        </p>
        {activeCandidateId ? (
          <ChecklistPanel
            sessionId={sessionId}
            candidateVideoRef={{ current: null } as any}
            onAllDone={() => {
              setVerifiedIds(prev => new Set(prev).add(activeCandidateId!))
              // Auto-advance to next unverified candidate
              const nextUnverified = candidates.find(c => c.id !== activeCandidateId && !verifiedIds.has(c.id))
              if (nextUnverified) {
                setTimeout(() => handleSelect(nextUnverified.id, nextUnverified.socketId), 400)
              }
            }}
          />
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6' }}>
            Select a candidate tile to begin verification.
          </p>
        )}
      </div>
    </div>
  )
}
