'use client'
import { useState, useRef, useEffect } from 'react'
import { Video, VideoOff, CheckCircle, Circle } from 'lucide-react'

interface ChecklistItem {
  id: string
  label: string
  completed: boolean
}

interface CandidateVerificationLayoutProps {
  sessionId: string
  candidateId: string
  examTitle: string
  proctorStream: MediaStream | null
  candidateStream: MediaStream | null
  socket: any
  proctorActive: boolean
}

export default function CandidateVerificationLayout({
  sessionId,
  candidateId,
  examTitle,
  proctorStream,
  candidateStream,
  socket,
  proctorActive,
}: CandidateVerificationLayoutProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: '1', label: 'Identity Verification', completed: false },
    { id: '2', label: 'Camera Check', completed: false },
    { id: '3', label: 'Microphone Check', completed: false },
    { id: '4', label: 'Environment Scan', completed: false },
    { id: '5', label: 'ID Document Verification', completed: false },
  ])
  const [verificationComplete, setVerificationComplete] = useState(false)

  const proctorVideoRef = useRef<HTMLVideoElement>(null)
  const candidateVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (proctorVideoRef.current && proctorStream) {
      proctorVideoRef.current.srcObject = proctorStream
      proctorVideoRef.current.play().catch(() => {})
    }
  }, [proctorStream])

  useEffect(() => {
    if (candidateVideoRef.current && candidateStream) {
      candidateVideoRef.current.srcObject = candidateStream
      candidateVideoRef.current.play().catch(() => {})
    }
  }, [candidateStream])

  useEffect(() => {
    if (!socket) return

    const handleChecklistUpdate = ({ candidateId: cId, itemId, completed }: any) => {
      if (cId === candidateId) {
        setChecklist(prev => prev.map(item => 
          item.id === itemId ? { ...item, completed } : item
        ))
      }
    }

    const handleVerificationComplete = ({ candidateId: cId }: any) => {
      if (cId === candidateId) {
        setVerificationComplete(true)
      }
    }

    socket.on('checklist.itemUpdated', handleChecklistUpdate)
    socket.on('checklist.candidateComplete', handleVerificationComplete)

    return () => {
      socket.off('checklist.itemUpdated', handleChecklistUpdate)
      socket.off('checklist.candidateComplete', handleVerificationComplete)
    }
  }, [socket, candidateId])

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-primary)', 
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '16px' }}>
        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: '700', 
          color: 'var(--text-primary)', 
          margin: 0 
        }}>
          Verification in Progress
        </h1>
        <p style={{ 
          color: 'var(--text-muted)', 
          fontSize: '14px', 
          marginTop: '4px',
          margin: 0
        }}>
          {examTitle} • Please wait while the proctor verifies your identity
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        flex: 1
      }}>
        {/* Left: Proctor Camera */}
        <div className="glass-card" style={{ 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Proctor
            </h3>
            {proctorActive && (
              <span style={{
                fontSize: '11px',
                color: 'var(--emerald)',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontWeight: '600'
              }}>
                ● ACTIVE
              </span>
            )}
          </div>

          <div style={{ 
            position: 'relative',
            flex: 1,
            minHeight: '400px',
            background: '#000',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {proctorActive && proctorStream ? (
              <video
                ref={proctorVideoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <VideoOff size={48} color="var(--text-muted)" />
                <p style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '14px',
                  textAlign: 'center',
                  maxWidth: '300px'
                }}>
                  {proctorActive 
                    ? 'Waiting for proctor video...' 
                    : 'Proctor camera will appear when they start verifying you'}
                </p>
              </div>
            )}
          </div>

          <p style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            margin: 0,
            textAlign: 'center'
          }}>
            The proctor can see and hear you during verification
          </p>
        </div>

        {/* Right: Candidate Camera + Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Candidate Self Camera */}
          <div className="glass-card" style={{ 
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Your Camera
            </h3>

            <div style={{ 
              position: 'relative',
              height: '280px',
              background: '#000',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid var(--cyan)'
            }}>
              {candidateStream ? (
                <video
                  ref={candidateVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <Video size={32} color="var(--text-muted)" />
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Camera not available
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Checklist Progress */}
          <div className="glass-card" style={{ 
            padding: '16px',
            flex: 1
          }}>
            <h3 style={{ 
              margin: '0 0 16px', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Verification Checklist
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {checklist.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: item.completed 
                      ? 'rgba(16, 185, 129, 0.1)' 
                      : 'var(--bg-elevated)',
                    borderRadius: '6px',
                    border: item.completed 
                      ? '1px solid var(--emerald)' 
                      : '1px solid transparent',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {item.completed ? (
                    <CheckCircle size={20} color="var(--emerald)" />
                  ) : (
                    <Circle size={20} color="var(--text-muted)" />
                  )}
                  <span style={{
                    fontSize: '14px',
                    color: item.completed ? 'var(--emerald)' : 'var(--text-secondary)',
                    fontWeight: item.completed ? '600' : '400'
                  }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {verificationComplete && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '2px solid var(--emerald)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--emerald)'
                }}>
                  ✓ Verification Complete
                </p>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}>
                  Waiting for all candidates to be verified...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="glass-card" style={{ 
        padding: '12px 16px',
        background: 'rgba(6, 182, 212, 0.1)',
        border: '1px solid var(--cyan)'
      }}>
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          💡 <strong>Instructions:</strong> Please remain seated and visible in your camera. 
          Follow the proctor's instructions for identity verification. The exam will begin once all candidates are verified.
        </p>
      </div>
    </div>
  )
}
