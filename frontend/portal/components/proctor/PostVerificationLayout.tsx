'use client'
import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, Video, VideoOff } from 'lucide-react'

interface Candidate {
  id: string
  name: string
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
  mcqSubmitted: boolean
}

interface PostVerificationLayoutProps {
  sessionId: string
  candidates: Candidate[]
  proctorStream: MediaStream | null
  onPushMCQ: () => void
  onPushPractical: () => void
  onDisqualify: (candidateId: string) => void
  mcqPushed: boolean
  allMcqSubmitted: boolean
}

export default function PostVerificationLayout({
  sessionId,
  candidates,
  proctorStream,
  onPushMCQ,
  onPushPractical,
  onDisqualify,
  mcqPushed,
  allMcqSubmitted,
}: PostVerificationLayoutProps) {
  const proctorVideoRef = useRef<HTMLVideoElement>(null)
  const [notifications, setNotifications] = useState<string[]>([])

  // Set proctor video stream
  useEffect(() => {
    if (proctorVideoRef.current && proctorStream) {
      proctorVideoRef.current.srcObject = proctorStream
      proctorVideoRef.current.play().catch(() => {})
    }
  }, [proctorStream])

  const addNotification = (message: string) => {
    setNotifications((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px', height: 'calc(100vh - 200px)' }}>
      {/* LEFT: Screen Share Grid + Proctor Camera */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Screen Share Grid */}
        <div
          className="glass-card"
          style={{
            flex: 1,
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {candidates.map((candidate, index) => (
            <div
              key={candidate.id}
              style={{
                position: 'relative',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--cyan)',
                borderRadius: '8px',
                padding: '8px',
                minHeight: '200px',
              }}
            >
              {/* Label */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(0,0,0,0.8)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  zIndex: 10,
                }}
              >
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--cyan)' }}>
                  Candidate {index + 1} - Screen and Camera
                </p>
              </div>

              {/* Screen Share */}
              <div style={{ position: 'relative', height: '100%' }}>
                {candidate.screenStream ? (
                  <video
                    ref={(el) => {
                      if (el && candidate.screenStream) {
                        el.srcObject = candidate.screenStream
                        el.play().catch(() => {})
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '6px',
                      background: '#000',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '6px',
                      background: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <Video size={32} color="var(--text-muted)" />
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No screen share</p>
                  </div>
                )}

                {/* Camera PIP */}
                {candidate.cameraStream && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      width: '120px',
                      height: '90px',
                      border: '2px solid var(--cyan)',
                      borderRadius: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    <video
                      ref={(el) => {
                        if (el && candidate.cameraStream) {
                          el.srcObject = candidate.cameraStream
                          el.play().catch(() => {})
                        }
                      }}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Status Badge */}
              {candidate.mcqSubmitted && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'var(--emerald)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    zIndex: 10,
                  }}
                >
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: '600', color: '#fff' }}>
                    ✓ MCQ Submitted
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Proctor Self Camera (Bottom Left) */}
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

      {/* RIGHT: Control Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Push Exam Buttons */}
        <div className="glass-card" style={{ padding: '16px' }}>
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
            Exam Control
          </h3>

          <button
            onClick={() => {
              onPushMCQ()
              addNotification('MCQ Exam pushed to all candidates')
            }}
            disabled={mcqPushed}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '10px',
              opacity: mcqPushed ? 0.5 : 1,
              cursor: mcqPushed ? 'not-allowed' : 'pointer',
            }}
          >
            {mcqPushed ? '✓ MCQ Pushed' : 'Push MCQ Exam'}
          </button>

          <button
            onClick={() => {
              onPushPractical()
              addNotification('Practical Exam pushed to all candidates')
            }}
            disabled={!allMcqSubmitted}
            className="btn-secondary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '600',
              opacity: allMcqSubmitted ? 1 : 0.5,
              cursor: allMcqSubmitted ? 'pointer' : 'not-allowed',
            }}
          >
            Push Practical Exam
          </button>

          {!allMcqSubmitted && (
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Disabled until all MCQ submitted
            </p>
          )}
        </div>

        {/* Notification Area */}
        <div
          className="glass-card"
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {/* Rotated Label */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '-40px',
              transform: 'rotate(90deg) translateX(-50%)',
              transformOrigin: 'center',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}
          >
            Notification Area as Candidates
          </div>

          <h3
            style={{
              margin: '0 0 12px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
            }}
          >
            Activity Log
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No notifications yet</p>
            ) : (
              notifications.map((notif, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px',
                    background: 'var(--bg-elevated)',
                    borderRadius: '6px',
                    borderLeft: '3px solid var(--cyan)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {notif}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Disqualify Button */}
        <button
          onClick={() => {
            const candidateId = prompt('Enter candidate ID to disqualify:')
            if (candidateId) {
              onDisqualify(candidateId)
              addNotification(`Candidate ${candidateId} disqualified`)
            }
          }}
          className="btn-ghost"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--rose)',
            borderColor: 'var(--rose)',
          }}
        >
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px' }} />
          DISQUALIFY
        </button>
      </div>
    </div>
  )
}
