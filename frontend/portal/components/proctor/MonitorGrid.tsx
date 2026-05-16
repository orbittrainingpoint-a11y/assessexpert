'use client'
import { useState, useEffect, useRef } from 'react'
import { sessionsApi, proctoringApi } from '@/lib/api'
import { Pause, Play, Maximize2, X, AlertTriangle, Video } from 'lucide-react'
import toast from 'react-hot-toast'

interface CandidateTile {
  id: string
  firstName: string
  lastName: string
  questionProgress: number
  totalQuestions: number
  faceStatus: 'present' | 'absent' | 'missing'
  screenStatus: 'active' | 'issue'
  submittedPractical?: boolean
  stream?: MediaStream | null
  screenStream?: MediaStream | null
}

interface Props {
  sessionId: string
  candidates: CandidateTile[]
  phase: 'mcq' | 'practical'
  onPause: () => void
  onResume: () => void
  isPaused: boolean
}

// Video tile component — handles its own stream assignment
function VideoTile({ stream, label, overlay }: { stream?: MediaStream | null; label: string; overlay?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!ref.current) return
    if (stream) {
      ref.current.srcObject = stream
      ref.current.play().catch(() => {})
    } else {
      ref.current.srcObject = null
    }
  }, [stream])

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
      {stream ? (
        <video ref={ref} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Video size={20} color="var(--text-muted)" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
        </div>
      )}
      {overlay}
    </div>
  )
}

export default function MonitorGrid({ sessionId, candidates, phase, onPause, onResume, isPaused }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [warnMsg, setWarnMsg] = useState('')
  const [warnTarget, setWarnTarget] = useState('')
  const [showWarnModal, setShowWarnModal] = useState(false)

  useEffect(() => {
    const sync = async () => {
      try {
        const { data } = await sessionsApi.getOne(sessionId)
        const end = data.mcqEndsAt || data.practicalEndsAt
        if (end) setTimeRemaining(Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000)))
      } catch {}
    }
    sync()
    const serverInterval = setInterval(sync, 30000)
    const tickInterval = setInterval(() => setTimeRemaining(t => Math.max(0, t - 1)), 1000)
    return () => { clearInterval(serverInterval); clearInterval(tickInterval) }
  }, [sessionId])

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const timerColor = timeRemaining < 300 ? 'var(--rose)' : timeRemaining < 600 ? 'var(--amber)' : 'var(--text-primary)'

  const sendWarning = async () => {
    if (!warnMsg.trim() || !warnTarget) return
    try {
      await proctoringApi.sendWarning(sessionId, `[To ${warnTarget}]: ${warnMsg}`)
      toast.success('Warning sent')
      setShowWarnModal(false); setWarnMsg(''); setWarnTarget('')
    } catch { toast.error('Failed to send warning') }
  }

  const expandedCandidate = candidates.find(c => c.id === expanded)

  return (
    <div>
      {/* Controls Bar */}
      <div className="glass-card" style={{ padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {phase === 'mcq' ? 'MCQ Phase' : 'Practical Phase'}
            </p>
            <span style={{ fontSize: '28px', fontWeight: '700', color: timerColor, fontFamily: 'monospace' }}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          {isPaused && (
            <span style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(215,119,6,0.15)', color: 'var(--amber)', fontSize: '12px', fontWeight: '600' }}>
              ⏸ PAUSED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" onClick={() => setShowWarnModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}>
            <AlertTriangle size={14} /> Send Warning
          </button>
          {isPaused ? (
            <button className="btn-primary" onClick={onResume} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <Play size={14} /> Resume All
            </button>
          ) : (
            <button className="btn-ghost" onClick={onPause} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}>
              <Pause size={14} /> Pause All
            </button>
          )}
        </div>
      </div>

      {/* Candidate Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {candidates.map(c => (
          <div key={c.id} onClick={() => setExpanded(c.id)}
            style={{ borderRadius: '10px', border: `1px solid ${c.faceStatus === 'missing' ? 'var(--rose)' : c.faceStatus === 'absent' ? 'var(--amber)' : 'var(--border)'}`, background: 'var(--bg-surface)', overflow: 'hidden', cursor: 'pointer' }}>
            <VideoTile
              stream={c.stream}
              label={`${c.firstName} ${c.lastName}`}
              overlay={
                <>
                  <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', background: c.faceStatus === 'present' ? 'var(--emerald)' : c.faceStatus === 'absent' ? 'var(--amber)' : 'var(--rose)' }} />
                  <div style={{ position: 'absolute', bottom: '6px', right: '6px', opacity: 0.6 }}><Maximize2 size={12} color="#fff" /></div>
                  {phase === 'practical' && c.submittedPractical && (
                    <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'var(--emerald)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#fff', fontWeight: '600' }}>Submitted ✓</div>
                  )}
                  {!c.stream && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', color: 'var(--amber)' }}>
                      WebRTC pending
                    </div>
                  )}
                </>
              }
            />
            <div style={{ padding: '10px 12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{c.firstName} {c.lastName}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {phase === 'mcq' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '3px', background: 'var(--bg-elevated)', borderRadius: '2px' }}>
                      <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${(c.questionProgress / c.totalQuestions) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>Q{c.questionProgress}/{c.totalQuestions}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                  <span style={{ color: c.faceStatus === 'present' ? 'var(--emerald)' : c.faceStatus === 'absent' ? 'var(--amber)' : 'var(--rose)' }}>
                    👤 {c.faceStatus === 'present' ? 'Face ✓' : c.faceStatus === 'absent' ? 'Face ⚠' : 'Face ✗'}
                  </span>
                  <span style={{ color: c.screenStatus === 'active' ? 'var(--emerald)' : 'var(--rose)' }}>
                    🖥 {c.screenStatus === 'active' ? 'Screen ✓' : 'Screen ⚠'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Modal */}
      {expanded && expandedCandidate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '700px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {expandedCandidate.firstName} {expandedCandidate.lastName}
              </h3>
              <button className="btn-ghost" onClick={() => setExpanded(null)} style={{ padding: '6px' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Camera Feed</p>
                <VideoTile stream={expandedCandidate.stream} label="Candidate Camera" />
              </div>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Screen Share</p>
                <VideoTile stream={expandedCandidate.screenStream} label="Waiting for screen share..." />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
              {[
                { label: 'Face Status', value: expandedCandidate.faceStatus, color: expandedCandidate.faceStatus === 'present' ? 'var(--emerald)' : 'var(--rose)' },
                { label: 'Screen Share', value: expandedCandidate.screenStatus, color: expandedCandidate.screenStatus === 'active' ? 'var(--emerald)' : 'var(--rose)' },
                { label: 'Progress', value: `Q${expandedCandidate.questionProgress}/${expandedCandidate.totalQuestions}`, color: 'var(--cyan)' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: '6px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: s.color, textTransform: 'capitalize' }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: 'var(--text-primary)' }}>Send Warning</h3>
            <select className="form-input" value={warnTarget} onChange={e => setWarnTarget(e.target.value)} style={{ marginBottom: '10px' }}>
              <option value="">Select candidate...</option>
              {candidates.map(c => <option key={c.id} value={`${c.firstName} ${c.lastName}`}>{c.firstName} {c.lastName}</option>)}
            </select>
            <textarea className="form-input" rows={3} value={warnMsg} onChange={e => setWarnMsg(e.target.value)} placeholder="Warning message..." style={{ resize: 'vertical', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={() => setShowWarnModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={sendWarning} disabled={!warnMsg.trim() || !warnTarget} style={{ flex: 1 }}>Send Warning</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
