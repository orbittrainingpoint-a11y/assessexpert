'use client'
import { useState, useRef, useEffect } from 'react'
import { User, Video, VideoOff } from 'lucide-react'
import CandidateTile from './CandidateTile'
import ChecklistPanel from './ChecklistPanel'

interface Candidate {
  id: string
  name: string
  stream: MediaStream | null
  socketId?: string
}

interface VerificationLayoutProps {
  sessionId: string
  candidates: Candidate[]
  proctorStream: MediaStream | null
  onCandidateSelect: (candidateId: string, socketId?: string) => void
  onAllVerifiedClick: () => void
  allVerified: boolean
}

export default function VerificationLayout({
  sessionId,
  candidates,
  proctorStream,
  onCandidateSelect,
  onAllVerifiedClick,
  allVerified,
}: VerificationLayoutProps) {
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(
    candidates.length > 0 ? candidates[0].id : null
  )
  const [verifiedCandidates, setVerifiedCandidates] = useState<Set<string>>(new Set())
  
  const proctorVideoRef = useRef<HTMLVideoElement>(null)
  const activeCandidateVideoRef = useRef<HTMLVideoElement>(null)

  // Set proctor video stream
  useEffect(() => {
    if (proctorVideoRef.current && proctorStream) {
      proctorVideoRef.current.srcObject = proctorStream
      proctorVideoRef.current.play().catch(() => {})
    }
  }, [proctorStream])

  // Set active candidate video stream
  useEffect(() => {
    const activeCandidate = candidates.find((c) => c.id === activeCandidateId)
    if (activeCandidateVideoRef.current && activeCandidate?.stream) {
      activeCandidateVideoRef.current.srcObject = activeCandidate.stream
      activeCandidateVideoRef.current.play().catch(() => {})
    }
  }, [activeCandidateId, candidates])

  const handleCandidateClick = (candidateId: string, socketId?: string) => {
    setActiveCandidateId(candidateId)
    onCandidateSelect(candidateId, socketId)
  }

  const handleChecklistComplete = (candidateId: string) => {
    setVerifiedCandidates((prev) => new Set(prev).add(candidateId))
  }

  const activeCandidate = candidates.find((c) => c.id === activeCandidateId)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', gap: '16px', height: 'calc(100vh - 200px)' }}>
      {/* LEFT: Active Candidate View (75%) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Large Active Candidate Camera */}
        <div
          className="glass-card"
          style={{
            flex: 1,
            padding: '16px',
            border: '3px solid var(--amber)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '16px',
              background: 'rgba(0,0,0,0.7)',
              padding: '6px 12px',
              borderRadius: '6px',
              zIndex: 10,
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#fff' }}>
              Active: {activeCandidate?.name || 'No candidate selected'}
            </p>
          </div>

          {activeCandidate?.stream ? (
            <video
              ref={activeCandidateVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '8px',
                background: '#000',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '8px',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <User size={64} color="var(--text-muted)" />
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                No video stream
              </p>
            </div>
          )}
        </div>

        {/* Proctor Self Camera (Bottom Left Corner) */}
        <div
          className="glass-card"
          style={{
            width: '200px',
            padding: '8px',
            background: 'rgba(255, 193, 7, 0.1)',
            border: '2px solid var(--amber)',
          }}
        >
          <div style={{ position: 'relative' }}>
            {proctorStream ? (
              <video
                ref={proctorVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '120px',
                  borderRadius: '6px',
                  background: '#000',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '120px',
                  borderRadius: '6px',
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <VideoOff size={24} color="var(--rose)" />
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                left: '6px',
                background: 'rgba(0,0,0,0.7)',
                padding: '3px 8px',
                borderRadius: '4px',
              }}
            >
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '600', color: '#fff' }}>
                You (Proctor)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE: Candidate List (25%) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="glass-card" style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Candidates
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {candidates.map((candidate, index) => (
              <CandidateTile
                key={candidate.id}
                candidateId={candidate.id}
                candidateName={`Candidate ${index + 1}`}
                isActive={candidate.id === activeCandidateId}
                isVerified={verifiedCandidates.has(candidate.id)}
                stream={candidate.stream}
                onClick={() => handleCandidateClick(candidate.id, candidate.socketId)}
              />
            ))}
          </div>
        </div>

        {/* Verified Done All Button */}
        <button
          onClick={onAllVerifiedClick}
          disabled={!allVerified}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '14px',
            fontWeight: '600',
            opacity: allVerified ? 1 : 0.5,
            cursor: allVerified ? 'pointer' : 'not-allowed',
          }}
        >
          ✓ Verified Done All Candidate
        </button>
      </div>

      {/* RIGHT: Checklist Panel */}
      <div className="glass-card" style={{ padding: '16px', overflowY: 'auto' }}>
        <h3
          style={{
            margin: '0 0 16px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Checklist
        </h3>

        {activeCandidateId ? (
          <ChecklistPanel
            sessionId={sessionId}
            candidateVideoRef={activeCandidateVideoRef}
            onAllDone={() => handleChecklistComplete(activeCandidateId)}
          />
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Select a candidate to begin verification
          </p>
        )}
      </div>
    </div>
  )
}
