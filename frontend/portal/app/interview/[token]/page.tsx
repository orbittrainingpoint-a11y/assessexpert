'use client'
import { useEffect, useRef, useState, use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Camera, Mic, MicOff, Video, VideoOff, ShieldCheck, AlertTriangle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { interviewsApi, brandingApi } from '@/lib/api'
import { useJitsi } from '@/lib/useJitsi'

type Phase = 'loading' | 'invalid' | 'expired' | 'consent' | 'permission' | 'waiting' | 'live' | 'ended'

export default function CandidateInterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [phase, setPhase] = useState<Phase>('loading')
  const [agreed, setAgreed] = useState(false)

  // Poll the public token endpoint so the candidate UI flips to 'ended'
  // when HR ends the interview from their side.
  const { data: interview, isLoading, error } = useQuery({
    queryKey: ['interview-public', token],
    queryFn: () => interviewsApi.getByToken(token).then(r => r.data),
    refetchInterval: 8_000,
    retry: false,
  })

  // Co-branding: pull the hiring org's logo + display name so the candidate
  // sees the customer's brand throughout the interview, not the platform
  // default. Public endpoint — no auth needed; the org id was already
  // returned from the magic-link lookup so we're not leaking anything new.
  const { data: branding } = useQuery({
    queryKey: ['branding-public', interview?.organizationId],
    queryFn: () => brandingApi.getPublic(interview!.organizationId).then(r => r.data),
    enabled: !!interview?.organizationId,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (isLoading) return
    if (error) {
      const msg = (error as any)?.response?.data?.message || ''
      setPhase(msg.toLowerCase().includes('expired') ? 'expired' : 'invalid')
      return
    }
    if (!interview) return
    if (interview.status === 'COMPLETED' || interview.status === 'CANCELLED') {
      setPhase('ended'); return
    }
    if (phase === 'loading') setPhase('consent')
    if (phase === 'waiting' && interview.status === 'IN_PROGRESS') setPhase('live')
  }, [interview, isLoading, error, phase])

  if (phase === 'loading' || isLoading) return <FullPage><Loader2 className="animate-spin" size={22} /> <span>Loading…</span></FullPage>
  if (phase === 'invalid') return <FullPage><AlertTriangle size={22} color="var(--rose)" /> <div><h2 style={{ margin: 0 }}>Invalid link</h2><p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>This interview link is not recognised.</p></div></FullPage>
  if (phase === 'expired') return <FullPage><Clock size={22} color="var(--amber)" /> <div><h2 style={{ margin: 0 }}>Link expired</h2><p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Please contact the hiring team for a new invite.</p></div></FullPage>
  if (phase === 'ended') return <FullPage><ShieldCheck size={22} color="var(--emerald)" /> <div><h2 style={{ margin: 0 }}>Interview complete</h2><p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Thank you for your time. You can close this window.</p></div></FullPage>

  if (phase === 'consent') {
    return (
      <CenteredCard title="Join your interview" subtitle={interview?.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : ''} branding={branding}>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', lineHeight: 1.55, fontSize: 14 }}>
          You're about to join a live video interview. By continuing you confirm that:
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
          <li>You agree to share your camera and microphone for the duration of the call.</li>
          <li>You agree to identity checks against your verification photo from the assessment.</li>
          <li>You're in a quiet, well-lit space and you are the same person who took the assessment.</li>
        </ul>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I understand and agree.</span>
        </label>
        <button onClick={() => setPhase('permission')} disabled={!agreed} className="btn-primary" style={{ width: '100%', padding: '12px 16px', fontWeight: 600, opacity: agreed ? 1 : 0.5, cursor: agreed ? 'pointer' : 'not-allowed' }}>
          Continue
        </button>
        <a
          href="/status"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            marginTop: 12,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            textDecoration: 'underline',
          }}
        >
          Test your setup first (opens in new tab)
        </a>
      </CenteredCard>
    )
  }

  if (phase === 'permission') {
    return <PermissionGate branding={branding} onReady={() => setPhase(interview?.status === 'IN_PROGRESS' ? 'live' : 'waiting')} />
  }

  if (phase === 'waiting') {
    return (
      <CenteredCard title="Waiting for the interviewer" subtitle="Your camera is ready. The interviewer will join shortly." branding={branding}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, background: 'var(--bg-base)', borderRadius: 8, marginTop: 8 }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Connecting…</span>
        </div>
      </CenteredCard>
    )
  }

  return <CandidateLive interview={interview} token={token} branding={branding} />
}

function CandidateLive({ interview, token, branding }: { interview: any; token: string; branding?: { logoUrl?: string | null; displayName?: string | null; brandColor?: string | null } }) {
  const selfRef = useRef<HTMLVideoElement>(null)
  const hrRef = useRef<HTMLVideoElement>(null)
  const [camOn, setCamOn] = useState(true)
  const [micOn, setMicOn] = useState(true)

  const { localCameraStream, peers, isConnected } = useJitsi({
    enabled: true,
    role: 'CANDIDATE',
    sessionId: interview.id,
    magicToken: token,
    candidateId: interview.candidateId,
    publishCamera: true,
    publishMic: true,
  })

  // HR peer = the PROCTOR side of the call.
  const hrPeer = Array.from(peers.values()).find((p: any) => p.role === 'PROCTOR') as any
  const hrStream: MediaStream | null = hrPeer?.cameraStream || null

  useEffect(() => {
    if (selfRef.current && localCameraStream && selfRef.current.srcObject !== localCameraStream) {
      selfRef.current.srcObject = localCameraStream
      selfRef.current.play().catch(() => {})
    }
  }, [localCameraStream])

  useEffect(() => {
    if (hrRef.current && hrStream && hrRef.current.srcObject !== hrStream) {
      hrRef.current.srcObject = hrStream
      hrRef.current.play().catch(() => {})
    }
  }, [hrStream])

  const toggleCam = () => {
    if (!localCameraStream) return
    const next = !camOn
    localCameraStream.getVideoTracks().forEach(t => { t.enabled = next })
    setCamOn(next)
  }
  const toggleMic = () => {
    if (!localCameraStream) return
    const next = !micOn
    localCameraStream.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Top status bar — co-branded with the hiring org */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {branding?.logoUrl && (
            <img src={branding.logoUrl} alt={branding.displayName || ''} style={{ height: 20, width: 'auto', objectFit: 'contain' }} />
          )}
          {branding?.displayName && (
            <span style={{ color: branding.brandColor || 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>
              {branding.displayName}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#10b981' : '#f59e0b' }} />
            {isConnected ? 'Connected' : 'Connecting…'} · Interview in progress
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{new Date(interview.scheduledAt).toLocaleString()}</span>
      </div>

      {/* Main video area: HR fills, candidate is PIP */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hrStream ? (
          <video ref={hrRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: 'calc(100vh - 140px)' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.6)' }}>
            <Loader2 size={28} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Waiting for the interviewer's video…</span>
          </div>
        )}

        {/* Self PIP */}
        <div style={{
          position: 'absolute', bottom: 20, right: 20,
          width: 180, height: 135, background: '#111', borderRadius: 10,
          overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {camOn ? (
            <video ref={selfRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
              <VideoOff size={22} />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>You</div>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(0,0,0,0.6)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={toggleMic} title={micOn ? 'Mute' : 'Unmute'} style={ctrlBtn(micOn)}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button onClick={toggleCam} title={camOn ? 'Turn camera off' : 'Turn camera on'} style={ctrlBtn(camOn)}>
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
      </div>
    </div>
  )
}

function ctrlBtn(on: boolean): React.CSSProperties {
  return {
    width: 44, height: 44, borderRadius: '50%',
    background: on ? 'rgba(255,255,255,0.12)' : '#ef4444',
    color: 'white', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

function PermissionGate({ onReady, branding }: { onReady: () => void; branding?: { logoUrl?: string | null; displayName?: string | null; brandColor?: string | null } }) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const request = async () => {
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      // Immediately stop — useJitsi will acquire its own stream once mounted.
      stream.getTracks().forEach(t => t.stop())
      setStatus('granted')
      setTimeout(onReady, 300)
    } catch (e: any) {
      setErrMsg(e?.message || 'Unable to access camera/microphone')
      setStatus('denied')
      toast.error('Please allow camera and microphone access to continue.')
    }
  }

  return (
    <CenteredCard title="Camera & microphone" subtitle="We need access to your camera and mic for the interview." branding={branding}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0 16px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,212,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)' }}>
          <Camera size={28} />
        </div>
        {status === 'denied' && (
          <div style={{ color: 'var(--rose)', fontSize: 13, textAlign: 'center' }}>
            <AlertTriangle size={16} style={{ verticalAlign: 'middle' }} /> {errMsg}
            <br /><span style={{ color: 'var(--text-muted)' }}>Update your browser permissions and try again.</span>
          </div>
        )}
      </div>
      <button onClick={request} disabled={status === 'requesting'} className="btn-primary" style={{ width: '100%', padding: '12px 16px', fontWeight: 600 }}>
        {status === 'requesting' ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: 6, verticalAlign: 'middle' }} /> Requesting…</> : status === 'denied' ? 'Try again' : 'Allow camera & mic'}
      </button>
    </CenteredCard>
  )
}

function CenteredCard({ title, subtitle, branding, children }: { title: string; subtitle?: string; branding?: { logoUrl?: string | null; displayName?: string | null; brandColor?: string | null }; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
        {/* Hiring company branding */}
        {branding && (branding.logoUrl || branding.displayName) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt={branding.displayName || 'Logo'} style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
            )}
            {branding.displayName && (
              <span style={{ fontSize: 14, fontWeight: 600, color: branding.brandColor || 'var(--cyan)' }}>
                {branding.displayName}
              </span>
            )}
          </div>
        )}
        <h1 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)', fontWeight: 600 }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 18px', color: 'var(--text-muted)', fontSize: 13 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', minWidth: 320 }}>
        {children}
      </div>
    </div>
  )
}
