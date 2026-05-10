'use client'
import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, VideoOff } from 'lucide-react'

interface Candidate {
  id: string
  name: string
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
  mcqSubmitted: boolean
}

interface Props {
  sessionId: string
  candidates: Candidate[]
  proctorStream: MediaStream | null
  onPushMCQ: () => void
  onPushPractical: () => void
  onDisqualify: (candidateId: string) => void
  mcqPushed: boolean
  allMcqSubmitted: boolean
}

function VideoBox({ stream, label, muted = true }: { stream: MediaStream | null; label: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    if (stream) ref.current.play().catch(() => {})
  }, [stream])
  return stream ? (
    <video ref={ref} autoPlay muted={muted} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
  ) : (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#111', borderRadius: '6px' }}>
      <VideoOff size={20} color="var(--text-muted)" />
      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

export default function PostVerificationLayout({ sessionId, candidates, proctorStream, onPushMCQ, onPushPractical, onDisqualify, mcqPushed, allMcqSubmitted }: Props) {
  const [notifications, setNotifications] = useState<{ time: string; msg: string; type: 'info' | 'warn' }[]>([])
  const [disqualifyId, setDisqualifyId] = useState('')

  const addNotif = (msg: string, type: 'info' | 'warn' = 'info') => {
    setNotifications(prev => [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg, type }, ...prev].slice(0, 20))
  }

  const proctorRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!proctorRef.current) return
    proctorRef.current.srcObject = proctorStream
    if (proctorStream) proctorRef.current.play().catch(() => {})
  }, [proctorStream])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '75fr 25fr', gap: '12px', height: 'calc(100vh - 160px)', minHeight: '600px' }}>

      {/* ── LEFT 75%: Candidate Grid ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
        {/* Candidate tiles grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', overflowY: 'auto', minHeight: 0 }}>
          {candidates.map((c, i) => (
            <div key={c.id} className="glass-card" style={{ padding: '8px', position: 'relative', border: `2px solid ${c.mcqSubmitted ? 'var(--emerald)' : 'var(--cyan)'}` }}>
              {/* Label */}
              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, background: 'rgba(0,0,0,0.8)', padding: '3px 8px', borderRadius: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--cyan)' }}>
                  {c.name} — Screen & Camera
                </span>
              </div>
              {/* MCQ submitted badge */}
              {c.mcqSubmitted && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: 'var(--emerald)', padding: '3px 8px', borderRadius: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#fff' }}>✓ MCQ Submitted</span>
                </div>
              )}
              {/* Screen share — main */}
              <div style={{ height: '160px', position: 'relative', marginTop: '4px' }}>
                <VideoBox stream={c.screenStream} label="No screen share" />
                {/* Camera PIP — bottom right */}
                {c.cameraStream && (
                  <div style={{ position: 'absolute', bottom: '6px', right: '6px', width: '80px', height: '60px', border: '2px solid var(--cyan)', borderRadius: '5px', overflow: 'hidden' }}>
                    <VideoBox stream={c.cameraStream} label="cam" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Proctor self camera — bottom left */}
        <div style={{ width: '200px', flexShrink: 0 }}>
          <div className="glass-card" style={{ padding: '8px', border: '2px solid var(--amber)', background: 'rgba(215,119,6,0.08)' }}>
            <div style={{ height: '112px', position: 'relative', background: '#000', borderRadius: '6px', overflow: 'hidden' }}>
              {proctorStream ? (
                <video ref={proctorRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VideoOff size={20} color="var(--rose)" />
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '4px', left: '6px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', color: 'var(--amber)', fontWeight: '600' }}>
                YOU (PROCTOR)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT 25%: Control Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
        {/* Push MCQ */}
        <button onClick={() => { onPushMCQ(); addNotif('MCQ Exam pushed to all candidates') }}
          disabled={mcqPushed} className="btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: '14px', fontWeight: '700', opacity: mcqPushed ? 0.5 : 1, cursor: mcqPushed ? 'not-allowed' : 'pointer' }}>
          {mcqPushed ? '✓ MCQ Pushed' : 'Push MCQ Exam'}
        </button>

        {/* Push Practical */}
        <button onClick={() => { onPushPractical(); addNotif('Practical Exam pushed to all candidates') }}
          disabled={!allMcqSubmitted} className="btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: '14px', fontWeight: '700', opacity: allMcqSubmitted ? 1 : 0.4, cursor: allMcqSubmitted ? 'pointer' : 'not-allowed', background: allMcqSubmitted ? undefined : 'var(--bg-elevated)', color: allMcqSubmitted ? undefined : 'var(--text-muted)', border: allMcqSubmitted ? undefined : '1px solid var(--border)' }}>
          Push Practical Exam
        </button>
        {!allMcqSubmitted && (
          <p style={{ margin: '-6px 0 0', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Disabled until all MCQ submitted
          </p>
        )}

        {/* Disqualify */}
        <div className="glass-card" style={{ padding: '12px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Disqualify Candidate</p>
          <select className="form-input" value={disqualifyId} onChange={e => setDisqualifyId(e.target.value)} style={{ marginBottom: '8px', fontSize: '12px' }}>
            <option value="">Select candidate...</option>
            {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-ghost" disabled={!disqualifyId}
            onClick={() => { if (disqualifyId) { onDisqualify(disqualifyId); addNotif(`${candidates.find(c => c.id === disqualifyId)?.name} disqualified`, 'warn'); setDisqualifyId('') } }}
            style={{ width: '100%', fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.4)', opacity: disqualifyId ? 1 : 0.4 }}>
            <AlertTriangle size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Disqualify
          </button>
        </div>

        {/* Live Notifications */}
        <div className="glass-card" style={{ flex: 1, padding: '12px', overflowY: 'auto', minHeight: 0 }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Notifications
          </p>
          {notifications.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No notifications yet</p>
          ) : notifications.map((n, i) => (
            <div key={i} style={{ padding: '7px 10px', background: 'var(--bg-elevated)', borderRadius: '5px', borderLeft: `3px solid ${n.type === 'warn' ? 'var(--rose)' : 'var(--cyan)'}`, marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{n.time}</span>{n.msg}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
