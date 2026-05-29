'use client'
import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Camera, CheckCircle2, XCircle, AlertCircle, Video, VideoOff, Mic, MicOff, ImageOff, ScanFace } from 'lucide-react'
import toast from 'react-hot-toast'
import { interviewsApi, candidatesApi } from '@/lib/api'
import { useJitsi } from '@/lib/useJitsi'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')

// Static-assets path on the backend lives under /uploads/* — referencePhotoPath
// in the DB is "./storage/fr-images/<id>.jpg"; strip everything up to & incl.
// "storage/" and prefix with the API origin's /uploads/ mount.
function refPhotoUrl(p?: string | null): string | null {
  if (!p) return null
  if (p.startsWith('http')) return p
  const rel = p.replace(/\\/g, '/').replace(/^\.?\/?storage\//, '')
  return `${API_ORIGIN}/uploads/${rel}`
}

export default function HRInterviewRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()

  const { data: interview, isLoading } = useQuery({
    queryKey: ['interview', id],
    queryFn: () => interviewsApi.getOne(id).then(r => r.data),
    refetchInterval: 10_000,
  })

  const { data: candidate } = useQuery({
    queryKey: ['interview-cand', interview?.candidateId],
    queryFn: () => candidatesApi.getOne(interview!.candidateId).then(r => r.data),
    enabled: !!interview?.candidateId,
  })

  // Start the interview on first open (idempotent on backend).
  const started = useRef(false)
  useEffect(() => {
    if (!interview || started.current) return
    if (interview.status === 'SCHEDULED') {
      started.current = true
      interviewsApi.start(id).then(() => qc.invalidateQueries({ queryKey: ['interview', id] })).catch(() => {})
    }
  }, [interview, id, qc])

  if (isLoading || !interview) {
    return <div style={{ padding: 40, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}><Loader2 size={18} className="animate-spin" /> Loading interview…</div>
  }

  const isCompleted = interview.status === 'COMPLETED' || interview.status === 'CANCELLED'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => router.push('/hr/interviews')} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}>
          <ArrowLeft size={14} /> All interviews
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
          {candidate ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email : 'Interview'}
        </h1>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{interview.status.replace('_', ' ')}</span>
      </div>

      {isCompleted ? (
        <CompletedView interview={interview} candidate={candidate} />
      ) : (
        <LiveRoom interviewId={id} interview={interview} candidate={candidate} />
      )}
    </div>
  )
}

function LiveRoom({ interviewId, interview, candidate }: { interviewId: string; interview: any; candidate: any }) {
  const qc = useQueryClient()
  const router = useRouter()
  const candidateVideoRef = useRef<HTMLVideoElement>(null)
  const proctorVideoRef = useRef<HTMLVideoElement>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [latestFR, setLatestFR] = useState<{ similarity: number; outcome: string; reason?: string } | null>(null)

  const jwtToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : ''
  // The Jitsi/WebRTC stack rooms are keyed by sessionId — for interviews
  // we use the interview id as a generic, unguessable room id. The
  // candidate joins the same room id from their token-gated page.
  const { localCameraStream, peers, isConnected } = useJitsi({
    enabled: !!jwtToken,
    role: 'PROCTOR',
    sessionId: interviewId,
    jwtToken,
    publishCamera: true,
    publishMic: true,
  })

  const candidatePeer = Array.from(peers.values()).find((p: any) => p.role === 'CANDIDATE') as any
  const candidateStream: MediaStream | null = candidatePeer?.cameraStream || null

  useEffect(() => {
    if (candidateVideoRef.current && candidateStream && candidateVideoRef.current.srcObject !== candidateStream) {
      candidateVideoRef.current.srcObject = candidateStream
      candidateVideoRef.current.play().catch(() => {})
    }
  }, [candidateStream])
  useEffect(() => {
    if (proctorVideoRef.current && localCameraStream) {
      proctorVideoRef.current.srcObject = localCameraStream
      proctorVideoRef.current.play().catch(() => {})
    }
  }, [localCameraStream])

  const refPhoto = refPhotoUrl(candidate?.referencePhotoPath)

  // Auto-FR every 30s once a candidate stream is live.
  useEffect(() => {
    if (!candidateStream || !candidateVideoRef.current) return
    const tick = async () => {
      const dataUrl = grabFrame(candidateVideoRef.current!)
      if (!dataUrl) return
      try {
        setVerifying(true)
        const { data } = await interviewsApi.verifyFrame(interviewId, dataUrl.split(',')[1])
        setLatestFR(data)
        qc.invalidateQueries({ queryKey: ['interview', interviewId] })
      } catch {/* best effort */} finally { setVerifying(false) }
    }
    // Fire once after a short warm-up, then on interval
    const warmup = setTimeout(tick, 5_000)
    const interval = setInterval(tick, 30_000)
    return () => { clearTimeout(warmup); clearInterval(interval) }
  }, [candidateStream, interviewId, qc])

  const manualVerifyMut = useMutation({
    mutationFn: (verified: boolean) => interviewsApi.manualVerify(interviewId, verified, verified ? 'HR visually confirmed match' : 'HR flagged mismatch'),
    onSuccess: () => { toast.success('Recorded'); qc.invalidateQueries({ queryKey: ['interview', interviewId] }) },
    onError: () => toast.error('Failed to record'),
  })

  const endMut = useMutation({
    mutationFn: (body: any) => interviewsApi.end(interviewId, body),
    onSuccess: () => { toast.success('Interview ended'); router.push('/hr/interviews') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'End failed'),
  })

  return (
    <>
      {/* Identity verification rail */}
      <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ScanFace size={20} color="var(--cyan)" />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Identity verification</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Auto-FR every 30s vs exam reference photo. Confirm visually below.</p>
          </div>
        </div>
        <FRBadge fr={latestFR ?? (interview.frVerdict ? { outcome: interview.frVerdict, similarity: interview.frSimilarity, reason: undefined } : null)} verifying={verifying} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => manualVerifyMut.mutate(true)} disabled={manualVerifyMut.isPending}
            className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12, color: 'var(--emerald)', borderColor: 'rgba(16,185,129,0.3)' }}>
            <CheckCircle2 size={14} /> Same person
          </button>
          <button onClick={() => manualVerifyMut.mutate(false)} disabled={manualVerifyMut.isPending}
            className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12, color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}>
            <XCircle size={14} /> Flag mismatch
          </button>
        </div>
      </div>

      {/* Main 2-pane: live candidate || exam reference photo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="glass-card" style={{ padding: 10, position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
          <Label>Live · candidate camera {!isConnected && <span style={{ color: 'var(--amber)' }}> · connecting…</span>}</Label>
          {candidateStream ? (
            <video ref={candidateVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
          ) : (
            <Placeholder icon={VideoOff} label="Candidate has not joined yet" />
          )}
          {/* HR PIP */}
          <div style={{ position: 'absolute', bottom: 16, right: 16, width: 140, aspectRatio: '16/9', border: '2px solid var(--amber)', borderRadius: 8, overflow: 'hidden', zIndex: 5 }}>
            {localCameraStream ? (
              <video ref={proctorVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : <Placeholder icon={VideoOff} label="No camera" />}
            <div style={{ position: 'absolute', bottom: 4, left: 6, background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 3, fontSize: 9, color: 'var(--amber)', fontWeight: 700 }}>YOU</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 10, position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
          <Label>Exam reference · captured during verification</Label>
          {refPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={refPhoto} alt="Exam reference photo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
          ) : (
            <Placeholder icon={ImageOff} label={candidate ? 'No reference photo on file' : 'Loading candidate…'} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={async () => {
          if (!candidateVideoRef.current) return
          const f = grabFrame(candidateVideoRef.current); if (!f) return
          try { setVerifying(true); const { data } = await interviewsApi.verifyFrame(interviewId, f.split(',')[1]); setLatestFR(data); qc.invalidateQueries({ queryKey: ['interview', interviewId] }) }
          catch (e: any) { toast.error(e?.response?.data?.message || 'FR check failed') }
          finally { setVerifying(false) }
        }} disabled={!candidateStream || verifying} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13 }}>
          <Camera size={14} /> {verifying ? 'Checking…' : 'Run FR check now'}
        </button>
        <button onClick={() => setEndOpen(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>End interview</button>
      </div>

      {endOpen && (
        <EndModal onClose={() => setEndOpen(false)} onSubmit={(body) => endMut.mutate(body)} pending={endMut.isPending} />
      )}
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 4, background: 'rgba(0,0,0,0.75)', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</div>
}

function Placeholder({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#080A14', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
      <Icon size={28} />
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  )
}

function FRBadge({ fr, verifying }: { fr: any; verifying: boolean }) {
  if (verifying) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}><Loader2 size={12} className="animate-spin" /> Checking…</span>
  if (!fr || !fr.outcome) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No check yet</span>
  const map: Record<string, { color: string; bg: string; icon: any }> = {
    VERIFIED: { color: 'var(--emerald)', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
    PENDING_REVIEW: { color: 'var(--amber)', bg: 'rgba(217,119,6,0.1)', icon: AlertCircle },
    REJECTED: { color: 'var(--rose)', bg: 'rgba(225,29,72,0.1)', icon: XCircle },
  }
  const cfg = map[fr.outcome] || map.PENDING_REVIEW
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg }} title={fr.reason || ''}>
      <Icon size={13} /> {fr.outcome.replace('_', ' ')} {typeof fr.similarity === 'number' ? `· ${fr.similarity.toFixed(0)}%` : ''}
    </span>
  )
}

function EndModal({ onClose, onSubmit, pending }: { onClose: () => void; onSubmit: (b: any) => void; pending: boolean }) {
  const [impression, setImpression] = useState('')
  const [recommendation, setRecommendation] = useState<'HIRE' | 'NO_HIRE' | 'HOLD'>('HIRE')
  const [notes, setNotes] = useState('')
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="glass-card" style={{ width: '100%', maxWidth: 520, padding: 28 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>End interview</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>Capture your impression while it's fresh — this lands in the candidate's record.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="im-rec" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Recommendation</label>
            <select id="im-rec" className="form-input" value={recommendation} onChange={e => setRecommendation(e.target.value as any)}>
              <option value="HIRE">Hire</option>
              <option value="HOLD">Hold / second round</option>
              <option value="NO_HIRE">Do not hire</option>
            </select>
          </div>
          <div>
            <label htmlFor="im-imp" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Overall impression</label>
            <textarea id="im-imp" className="form-input" rows={3} value={impression} onChange={e => setImpression(e.target.value)} placeholder="Strengths, gaps, communication, etc." style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label htmlFor="im-notes" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Private notes (optional)</label>
            <textarea id="im-notes" className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>Cancel</button>
            <button onClick={() => onSubmit({ impression, recommendation, notes, verdict: recommendation })} disabled={pending}
              className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {pending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save & end'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompletedView({ interview, candidate }: { interview: any; candidate: any }) {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary)' }}>Outcome</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Field label="Recommendation" value={interview.recommendation || '—'} />
        <Field label="Verdict" value={interview.verdict || '—'} />
        <Field label="FR auto-check" value={interview.frVerdict ? `${interview.frVerdict}${interview.frSimilarity != null ? ` (${interview.frSimilarity.toFixed(0)}%)` : ''}` : '—'} />
        <Field label="Manual verify" value={interview.manualVerified == null ? '—' : (interview.manualVerified ? 'Confirmed' : 'Mismatch flagged')} />
        <Field label="Ended at" value={interview.endedAt ? new Date(interview.endedAt).toLocaleString() : '—'} />
      </div>
      {interview.impression && (
        <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 8, marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Impression</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{interview.impression}</p>
        </div>
      )}
      {interview.notes && (
        <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 8 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{interview.notes}</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</p>
    </div>
  )
}

// Snap a 640px-wide JPEG frame from the candidate video — same compression
// strategy as the exam page so backend body parsers stay happy.
function grabFrame(video: HTMLVideoElement): string | null {
  if (!video.videoWidth) return null
  const MAX = 640
  const scale = video.videoWidth > MAX ? MAX / video.videoWidth : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}
