'use client'
import { Check, User } from 'lucide-react'

interface CandidateTileProps {
  candidateId: string
  candidateName: string
  isActive: boolean
  isVerified: boolean
  stream: MediaStream | null
  onClick: () => void
}

export default function CandidateTile({
  candidateId,
  candidateName,
  isActive,
  isVerified,
  stream,
  onClick,
}: CandidateTileProps) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'var(--bg-elevated)',
        border: isActive ? '2px solid var(--cyan)' : '1px solid var(--border)',
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      className="candidate-tile"
    >
      {/* Video Preview */}
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        {stream ? (
          <video
            ref={(el) => {
              if (el && stream) {
                el.srcObject = stream
                el.play().catch(() => {})
              }
            }}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '80px',
              borderRadius: '6px',
              background: '#000',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '80px',
              borderRadius: '6px',
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={24} color="var(--text-muted)" />
          </div>
        )}

        {/* Verified Badge */}
        {isVerified && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'var(--emerald)',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={14} color="#fff" />
          </div>
        )}

        {/* Active Indicator */}
        {isActive && (
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              left: '4px',
              background: 'var(--cyan)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              color: '#000',
            }}
          >
            ACTIVE
          </div>
        )}
      </div>

      {/* Candidate Name */}
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: isActive ? '600' : '500',
          color: isActive ? 'var(--cyan)' : 'var(--text-primary)',
          textAlign: 'center',
        }}
      >
        {candidateName}
      </p>

      {/* Status */}
      <p
        style={{
          margin: '4px 0 0',
          fontSize: '11px',
          color: isVerified ? 'var(--emerald)' : 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        {isVerified ? '✓ Verified' : 'Pending'}
      </p>
    </div>
  )
}
