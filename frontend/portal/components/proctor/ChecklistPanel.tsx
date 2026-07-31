'use client'
import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Circle, Camera, RotateCcw } from 'lucide-react'
import { checklistApi, faceCaptureApi } from '@/lib/api'
import { detectFaceInImage } from '@/lib/detectFaceInImage'
import toast from 'react-hot-toast'

export type ChecklistItemKey =
  | 'camera_verified'
  | 'identity_name'
  | 'identity_email'
  | 'government_id'
  | 'background_scan'
  | 'no_materials'
  | 'facial_recognition'
  | 'screen_share'
  | 'guardpro'
  | 'guidelines_agreed'

export interface ChecklistState {
  [key: string]: 'pending' | 'active' | 'done'
}

interface ActiveCandidate {
  id: string
  firstName?: string
  lastName?: string
  email?: string
}

interface Props {
  sessionId: string
  candidateVideoRef: React.RefObject<HTMLVideoElement | null>
  candidateStream?: MediaStream | null
  /** The candidate currently being verified — drives identity validation
   *  and per-candidate checklist state. */
  candidate?: ActiveCandidate
  onAllDone: () => void
  onRequestScreenShare?: () => void
  candidateScreenShareActive?: boolean
  /** Emit a socket request to the candidate to open the guidelines popup. */
  onRequestGuidelinesAgreement?: () => void
  /** True once the candidate has accepted the guidelines on their side. */
  candidateAgreedToGuidelines?: boolean
}

const ITEMS: { key: ChecklistItemKey; title: string; description: string }[] = [
  { key: 'camera_verified',    title: 'Camera Verification',        description: 'Confirm candidate face is clearly visible and camera is active.' },
  { key: 'identity_name',      title: 'Verbal Identity (Name)',     description: 'Ask candidate to state their full legal name.' },
  { key: 'identity_email',     title: 'Verbal Identity (Email)',    description: 'Ask candidate to state their email address.' },
  { key: 'government_id',      title: 'Identity Check',             description: 'Ask the candidate to hold any photo ID (passport, Emirates ID, driver\'s licence, national ID, employee badge) in view. Capture the frame and visually confirm the photo + name match the candidate.' },
  { key: 'background_scan',    title: 'Environment Scan',           description: 'Ask candidate to rotate camera 360° to show the full room.' },
  { key: 'no_materials',       title: 'No Unauthorized Materials',  description: 'Confirm no reference materials, secondary monitors, or other people visible.' },
  { key: 'facial_recognition', title: 'Facial Recognition',         description: 'Run facial recognition against government ID.' },
  { key: 'screen_share',       title: 'Screen Share',               description: 'Confirm screen share is active and full screen.' },
  // GuardPro is a manual confirmation step — there is no auto-fetch
  // from any external monitoring product yet. Proctor visually inspects
  // the candidate's tech-check results in their own browser and ticks
  // this off. Wire to a real integration when the product is built.
  { key: 'guardpro',           title: 'GuardPro / Tech Check (manual)', description: 'Proctor confirms candidate has run the tech check successfully.' },
  { key: 'guidelines_agreed',  title: 'Guidelines & Agreement',     description: 'Read exam guidelines aloud and confirm candidate agrees.' },
]

function ItemIdentityName({
  saving,
  onComplete,
  expectedName,
}: {
  saving: boolean
  onComplete: (d: any) => void
  expectedName: string
}) {
  const [name, setName] = useState('')
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const matches = !!name.trim() && norm(name) === norm(expectedName)
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to state their full legal name. Type EXACTLY what they say — it must match the record on file.
      </div>
      <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name as stated by candidate"
        style={{ fontSize: '13px', marginBottom: '8px', borderColor: !name.trim() ? undefined : matches ? 'var(--emerald)' : 'var(--rose)' }} />
      {name.trim() && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', borderRadius: '6px',
          background: matches ? 'rgba(5,150,105,0.08)' : 'rgba(225,29,72,0.08)',
          border: `1px solid ${matches ? 'rgba(5,150,105,0.3)' : 'rgba(225,29,72,0.3)'}`,
          fontSize: '12px', color: matches ? 'var(--emerald)' : 'var(--rose)' }}>
          {matches ? '✓ Matches record' : `✗ Does NOT match — record shows "${expectedName}"`}
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !matches}
        onClick={() => onComplete({ value: name, matched: matches })}>
        {saving ? 'Saving...' : matches ? 'Name Confirmed' : 'Name must match to continue'}
      </button>
    </div>
  )
}

function ItemIdentityEmail({
  saving,
  onComplete,
  expectedEmail,
}: {
  saving: boolean
  onComplete: (d: any) => void
  expectedEmail: string
}) {
  const [email, setEmail] = useState('')
  const matches = !!email.trim() && email.trim().toLowerCase() === expectedEmail.trim().toLowerCase()
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to state their email address. It must match the record on file.
      </div>
      <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email as stated by candidate"
        style={{ fontSize: '13px', marginBottom: '8px', borderColor: !email.trim() ? undefined : matches ? 'var(--emerald)' : 'var(--rose)' }} />
      {email.trim() && (
        <div style={{ marginBottom: '10px', padding: '8px 10px', borderRadius: '6px',
          background: matches ? 'rgba(5,150,105,0.08)' : 'rgba(225,29,72,0.08)',
          border: `1px solid ${matches ? 'rgba(5,150,105,0.3)' : 'rgba(225,29,72,0.3)'}`,
          fontSize: '12px', color: matches ? 'var(--emerald)' : 'var(--rose)' }}>
          {matches ? '✓ Matches record' : `✗ Does NOT match — record shows "${expectedEmail}"`}
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !matches}
        onClick={() => onComplete({ value: email, matched: matches })}>
        {saving ? 'Saving...' : matches ? 'Email Confirmed' : 'Email must match to continue'}
      </button>
    </div>
  )
}

function ItemGovernmentId({ candidateStream, saving, onComplete }: { sessionId: string; candidateId?: string; candidateStream?: MediaStream | null; saving: boolean; onComplete: (d: any) => void }) {
  // Real frame capture + visual confirmation. The previous version fabricated
  // a 97.3% similarity (with a fixed "AUTO VERIFIED" verdict) even on errors,
  // and never actually captured a photo. Now the proctor takes a real frame
  // of the candidate holding their ID, visually verifies it matches, and
  // ticks the item. The dedicated "Facial Recognition" item runs the real
  // server-side FR comparison against the reference photo.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [state, setState] = useState<'idle' | 'captured' | 'error'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (candidateStream && v.srcObject !== candidateStream) {
      v.srcObject = candidateStream
      v.play().catch(() => {})
    }
  }, [candidateStream])

  const captureId = async () => {
    setErrorMsg(null)
    if (!candidateStream) { setErrorMsg('Candidate camera not available yet.'); setState('error'); return }
    const v = videoRef.current
    if (!v) { setErrorMsg('Video element not mounted yet — retry.'); setState('error'); return }
    // Wait up to 10s for the WebRTC video to produce a real frame.
    const start = Date.now()
    while (Date.now() - start < 10_000) {
      if (v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2) break
      await new Promise(r => setTimeout(r, 150))
    }
    if (!v.videoWidth) {
      setErrorMsg('Candidate video did not produce a frame after 10s. Ask the candidate to refresh, then retry.')
      setState('error')
      return
    }
    try {
      const MAX_WIDTH = 800
      const scale = v.videoWidth > MAX_WIDTH ? MAX_WIDTH / v.videoWidth : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(v.videoWidth * scale)
      canvas.height = Math.round(v.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not available')
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      setPreview(canvas.toDataURL('image/jpeg', 0.85))
      setState('captured')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Capture failed')
      setState('error')
    }
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to hold any photo identity document (passport, Emirates ID, driver's licence, national ID, employee badge) clearly in front of the camera, then capture the frame. Visually confirm the photo and details match the candidate before ticking. Automatic face matching against the reference photo runs in the next step.
      </div>

      {/* Hidden video element fed by the candidate's live stream */}
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />

      {state === 'idle' && (
        <button className="btn-primary" style={{ width: '100%', padding: '10px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={captureId} disabled={!candidateStream}>
          <Camera size={14} /> Capture ID Photo
        </button>
      )}

      {state === 'error' && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ padding: '10px', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--rose)', marginBottom: '8px' }}>
            {errorMsg}
          </div>
          <button className="btn-ghost" style={{ width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => { setState('idle'); setErrorMsg(null) }}>
            <RotateCcw size={12} /> Try Again
          </button>
        </div>
      )}

      {state === 'captured' && preview && (
        <div style={{ marginBottom: '10px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px' }}>
          <img src={preview} alt="Captured ID frame"
            style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '6px', marginBottom: '8px', background: '#000' }} />
          <button className="btn-ghost" style={{ width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
            onClick={() => { setState('idle'); setPreview(null) }}>
            <RotateCcw size={12} /> Recapture
          </button>
        </div>
      )}

      <button className="btn-primary" style={{ width: '100%', padding: '10px' }}
        disabled={saving || state !== 'captured'}
        onClick={() => onComplete({ value: { capturedImage: preview, capturedAt: new Date().toISOString() } })}>
        {saving ? 'Saving...' : 'ID Visually Verified'}
      </button>
    </div>
  )
}

function ItemFacialRecognition({
  sessionId,
  candidateId,
  candidateStream,
  saving,
  onComplete,
}: {
  sessionId: string
  candidateId?: string
  candidateStream?: MediaStream | null
  saving: boolean
  onComplete: (d: any) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [state, setState] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<{
    faceDetected: boolean
    capturePath?: string
    quality?: any
    similarity?: number
    outcome?: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED'
    reason?: string
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (candidateStream && v.srcObject !== candidateStream) {
      v.srcObject = candidateStream
      v.play().catch(() => {})
    }
  }, [candidateStream])

  // Auto-run capture as soon as the candidate stream arrives. Avoids the
  // "click manually every time" friction the user reported. The capture
  // function itself now waits for the video to produce a frame before
  // grabbing pixels, so we just kick it off here.
  useEffect(() => {
    if (state !== 'idle') return
    if (!candidateStream) return
    // Schedule one tick so React has time to bind the stream to the video
    // element. capture() handles the rest of the wait.
    const t = setTimeout(() => {
      if (state === 'idle' && candidateStream) capture()
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateStream, state])

  // Block until the hidden video element actually has a frame to read. The
  // previous version errored out instantly with "Video feed is not ready"
  // when the WebRTC stream had been bound but the first frame hadn't
  // landed yet — a sub-second race in practice but very visible to the
  // proctor. Now we poll every 150ms for up to 10s and only error if the
  // stream genuinely never delivers a frame.
  const waitForVideoFrame = async (v: HTMLVideoElement, timeoutMs = 10_000): Promise<boolean> => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2) return true
      await new Promise(r => setTimeout(r, 150))
    }
    return false
  }

  const capture = async () => {
    if (!candidateStream) {
      setErrorMsg('Candidate camera not available — wait for the WebRTC connection.')
      setState('error')
      return
    }
    const v = videoRef.current
    if (!v) {
      setErrorMsg('Video element not mounted yet — retry.')
      setState('error')
      return
    }
    setState('capturing')
    setErrorMsg(null)

    const ready = await waitForVideoFrame(v)
    if (!ready) {
      setErrorMsg('Candidate video did not produce a frame after 10s. Ask the candidate to refresh, then retry.')
      setState('error')
      return
    }
    try {
      // Downscale to a 640px-wide frame before encoding. MediaPipe FR
      // works fine on 640×480 input and we keep the base64 payload
      // around 50-80 KB — well under the 10 MB server cap, but more
      // importantly fast over a flaky candidate connection. Without
      // this, a 1080p webcam frame at quality 0.85 produced ~300 KB
      // of base64 which used to overflow the old 100 KB default body
      // parser limit and 500-error the capture mid-checklist.
      const MAX_WIDTH = 640
      const scale = v.videoWidth > MAX_WIDTH ? MAX_WIDTH / v.videoWidth : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(v.videoWidth * scale)
      canvas.height = Math.round(v.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context failed')
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setPreview(dataUrl)
      const imageBase64 = dataUrl.split(',')[1]

      // Detect the face in the BROWSER (MediaPipe Tasks Vision is
      // browser-only — `@mediapipe/tasks-vision` fails in Node with
      // `navigator is not defined`). Pass the result to the backend so
      // it can persist an accurate faceDetected flag without needing a
      // Node face-detection library.
      const clientDetection = await detectFaceInImage(dataUrl)
      const { data } = await faceCaptureApi.captureIdVerification(
        sessionId,
        imageBase64,
        'facial_recognition',
        candidateId,
        {
          clientFaceCount: clientDetection.faceCount,
          clientFaceConfidence: clientDetection.bestConfidence,
        },
      )
      // Trust the browser's detection first (it actually ran); fall back
      // to whatever the backend reported if the browser detector errored.
      const faceDetected = clientDetection.error
        ? !!data.faceDetected
        : clientDetection.faceCount > 0
      setResult({
        faceDetected,
        capturePath: data.capturePath,
        quality: data.quality,
        similarity: typeof data.similarity === 'number' ? data.similarity : undefined,
        outcome: data.outcome,
        reason: data.reason,
      })
      setState('done')
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message || e?.message || 'Capture failed')
      setState('error')
    }
  }

  const retry = () => {
    setState('idle')
    setResult(null)
    setPreview(null)
    setErrorMsg(null)
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to look directly at the camera. The captured image will be stored with the exam record and included in the final report.
      </div>

      {/* Hidden video element fed by the candidate's stream */}
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />

      {state === 'idle' && (
        <button className="btn-primary" style={{ width: '100%', padding: '10px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={capture} disabled={!candidateStream}>
          <Camera size={14} /> Capture Candidate Face
        </button>
      )}

      {state === 'capturing' && (
        <div style={{ padding: '10px', background: 'rgba(0,212,255,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--cyan)', textAlign: 'center', marginBottom: '10px' }}>
          Uploading & running face detection...
        </div>
      )}

      {state === 'error' && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ padding: '10px', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--rose)', marginBottom: '8px' }}>
            {errorMsg}
          </div>
          <button className="btn-ghost" style={{ width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={retry}>
            <RotateCcw size={12} /> Try Again
          </button>
        </div>
      )}

      {state === 'done' && result && (
        <div style={{ marginBottom: '10px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px' }}>
          {preview && (
            <img src={preview} alt="Captured face"
              style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '6px', marginBottom: '8px', background: '#000' }} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Face Detected</span>
            <span style={{ color: result.faceDetected ? 'var(--emerald)' : 'var(--rose)', fontWeight: '600' }}>
              {result.faceDetected ? 'YES' : 'NO'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Image Quality</span>
            <span style={{ color: result.quality?.isValid ? 'var(--emerald)' : 'var(--amber)' }}>
              {result.quality?.isValid ? 'OK' : 'LOW'}
            </span>
          </div>
          {typeof result.similarity === 'number' && result.outcome && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Similarity vs Reference</span>
              <span style={{
                color: result.outcome === 'VERIFIED' ? 'var(--emerald)' :
                       result.outcome === 'PENDING_REVIEW' ? 'var(--amber)' : 'var(--rose)',
                fontWeight: '600',
              }}>
                {result.similarity.toFixed(1)}% · {result.outcome.replace('_', ' ')}
              </span>
            </div>
          )}
          {(() => {
            const ok = result.outcome === 'VERIFIED'
            const review = result.outcome === 'PENDING_REVIEW'
            const colour = ok ? 'var(--emerald)' : review ? 'var(--amber)' : 'var(--rose)'
            const bg = ok ? 'rgba(5,150,105,0.1)' : review ? 'rgba(215,119,6,0.1)' : 'rgba(225,29,72,0.1)'
            const border = ok ? 'rgba(5,150,105,0.3)' : review ? 'rgba(215,119,6,0.3)' : 'rgba(225,29,72,0.3)'
            const text = ok
              ? '✓ Face matches the candidate on file'
              : review
                ? '⚠ Borderline match — confirm visually before proceeding'
                : (result.reason || '✗ Does not match — recapture or escalate')
            return (
              <div style={{ padding: '6px', borderRadius: '6px', background: bg, border: `1px solid ${border}`,
                fontSize: '12px', fontWeight: '600', color: colour, textAlign: 'center' }}>
                {text}
              </div>
            )
          })()}
          <button className="btn-ghost" style={{ width: '100%', padding: '8px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
            onClick={retry}>
            <RotateCcw size={12} /> Recapture
          </button>
        </div>
      )}

      <button className="btn-primary" style={{ width: '100%', padding: '10px' }}
        disabled={saving || state !== 'done' || result?.outcome === 'REJECTED' || !result?.faceDetected}
        onClick={() => onComplete({
          value: {
            capturePath: result?.capturePath,
            faceDetected: result?.faceDetected,
            quality: result?.quality,
            similarity: result?.similarity,
            outcome: result?.outcome,
            reason: result?.reason,
            capturedAt: new Date().toISOString(),
          },
        })}>
        {saving
          ? 'Saving...'
          : result?.outcome === 'REJECTED'
            ? 'Cannot confirm — recapture or escalate'
            : result?.outcome === 'PENDING_REVIEW'
              ? 'Confirm (Manual Override)'
              : 'Facial Recognition Confirmed'}
      </button>
    </div>
  )
}

function ItemEnvironmentScan({ saving, onComplete }: { saving: boolean; onComplete: (d: any) => void }) {
  const [checks, setChecks] = useState({ noPeople: false, noMaterials: false, noMonitor: false, deskClear: false })
  const allChecked = Object.values(checks).every(Boolean)
  const toggle = (k: keyof typeof checks) => setChecks(p => ({ ...p, [k]: !p[k] }))
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to slowly rotate their camera 360° to show the entire room.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {([
          ['noPeople',    'No other people visible in the room'],
          ['noMaterials', 'No unauthorized reference materials visible'],
          ['noMonitor',   'No secondary monitor connected or visible'],
          ['deskClear',   'Desk is clear — only permitted items present'],
        ] as [keyof typeof checks, string][]).map(([k, label]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '6px', background: checks[k] ? 'rgba(5,150,105,0.08)' : 'var(--bg-base)', border: `1px solid ${checks[k] ? 'rgba(5,150,105,0.3)' : 'var(--border)'}` }}>
            <input type="checkbox" checked={checks[k]} onChange={() => toggle(k)} style={{ width: '16px', height: '16px', accentColor: 'var(--emerald)' }} />
            <span style={{ fontSize: '13px', color: checks[k] ? 'var(--emerald)' : 'var(--text-secondary)' }}>{label}</span>
          </label>
        ))}
      </div>
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !allChecked}
        onClick={() => onComplete({ value: checks })}>
        {saving ? 'Saving...' : 'Environment Clear'}
      </button>
    </div>
  )
}

function ItemScreenShare({
  saving,
  onComplete,
  onRequestCandidateScreenShare,
  candidateSharing,
}: {
  saving: boolean
  onComplete: (d: any) => void
  onRequestCandidateScreenShare?: () => void
  candidateSharing?: boolean
}) {
  const [requested, setRequested] = useState(false)
  const requestShare = () => {
    onRequestCandidateScreenShare?.()
    setRequested(true)
  }
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Request the candidate to share their screen. They will see a prompt on their screen.
      </div>
      {!requested && !candidateSharing && (
        <button className="btn-primary" style={{ width: '100%', padding: '10px', marginBottom: '8px' }} onClick={requestShare}>
          Request Screen Share from Candidate
        </button>
      )}
      {requested && !candidateSharing && (
        <div style={{ padding: '10px', background: 'rgba(0,212,255,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--cyan)', textAlign: 'center', marginBottom: '10px' }}>
          ⏳ Waiting for candidate to share screen...
        </div>
      )}
      {candidateSharing && (
        <div style={{ padding: '10px', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.4)', borderRadius: '6px', fontSize: '13px', color: 'var(--emerald)', textAlign: 'center', marginBottom: '10px', fontWeight: 600 }}>
          ✓ Candidate is sharing their screen
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !candidateSharing}
        onClick={() => onComplete({ value: 'active' })}>
        {saving ? 'Saving...' : 'Screen Share Confirmed'}
      </button>
    </div>
  )
}

function ItemTechCheck({ saving, onComplete }: { saving: boolean; onComplete: (d: any) => void }) {
  const [checks, setChecks] = useState<{ label: string; value: string; ok: boolean }[]>([])
  const [probing, setProbing] = useState(true)

  // Real browser probes — runs once when the step becomes active. These are
  // proctor-side probes (the proctor is doing the verification on their own
  // browser, not the candidate's), so they reflect the proctor's environment.
  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      const results: { label: string; value: string; ok: boolean }[] = []

      // 1. Network — navigator.connection (Chromium); fall back to fetch timing
      try {
        const c: any = (navigator as any).connection
        if (c?.downlink && c.downlink > 0) {
          results.push({
            label: 'Internet (estimate)',
            value: `${c.downlink.toFixed(1)} Mbps · ${c.effectiveType || '?'}`,
            ok: c.downlink >= 2,
          })
        } else {
          // Light HTTP timing probe — fetch a tiny known asset
          const t0 = performance.now()
          await fetch('/favicon.ico', { cache: 'no-store' }).catch(() => null)
          const ms = performance.now() - t0
          results.push({
            label: 'Network reachable',
            value: `${ms.toFixed(0)} ms RTT`,
            ok: ms < 1500,
          })
        }
      } catch {
        results.push({ label: 'Internet (estimate)', value: 'Unknown', ok: false })
      }

      // 2. Camera + Mic — enumerate devices and check permission
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter(d => d.kind === 'videoinput')
        const mics = devices.filter(d => d.kind === 'audioinput')
        results.push({
          label: 'Camera',
          value: cams.length ? `${cams.length} device${cams.length === 1 ? '' : 's'}` : 'None',
          ok: cams.length > 0,
        })
        results.push({
          label: 'Microphone',
          value: mics.length ? `${mics.length} device${mics.length === 1 ? '' : 's'}` : 'None',
          ok: mics.length > 0,
        })
      } catch {
        results.push({ label: 'Camera', value: 'Permission needed', ok: false })
        results.push({ label: 'Microphone', value: 'Permission needed', ok: false })
      }

      // 3. Browser
      const ua = navigator.userAgent
      let browser = 'Unknown'
      const match = ua.match(/(Edg|Chrome|Firefox|Safari|OPR)\/(\d+)/)
      if (match) browser = `${match[1].replace('Edg', 'Edge').replace('OPR', 'Opera')} ${match[2]}`
      const chromiumOk = /Chrome|Edg/.test(ua)
      results.push({
        label: 'Browser',
        value: browser,
        ok: chromiumOk,
      })

      // 4. Screen resolution
      const w = window.screen.width
      const h = window.screen.height
      results.push({
        label: 'Screen Resolution',
        value: `${w}×${h}`,
        ok: w >= 1280 && h >= 720,
      })

      // 5. Fullscreen support
      results.push({
        label: 'Fullscreen API',
        value: typeof document.documentElement.requestFullscreen === 'function' ? 'Supported' : 'Not supported',
        ok: typeof document.documentElement.requestFullscreen === 'function',
      })

      // 6. WebRTC support
      const webrtcOk = typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
      results.push({
        label: 'WebRTC',
        value: webrtcOk ? 'Supported' : 'Not supported',
        ok: webrtcOk,
      })

      if (!cancelled) {
        setChecks(results)
        setProbing(false)
      }
    }
    probe()
    return () => { cancelled = true }
  }, [])

  const allPassed = checks.length > 0 && checks.every(c => c.ok)
  const failed = checks.filter(c => !c.ok)

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {probing ? (
        <div style={{ padding: '14px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '10px' }}>
          Running real-time technical checks...
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {checks.map(c => (
              <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                <span style={{ color: c.ok ? 'var(--emerald)' : 'var(--rose)', fontWeight: '500' }}>{c.value} {c.ok ? '✅' : '❌'}</span>
              </div>
            ))}
          </div>
          {failed.length > 0 && (
            <div style={{ padding: '8px 10px', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--rose)', marginBottom: '10px' }}>
              {failed.length} check{failed.length === 1 ? '' : 's'} failed. You can still proceed but note them in the report.
            </div>
          )}
        </>
      )}
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || probing}
        onClick={() => onComplete({ value: { allPassed, checks } })}>
        {saving ? 'Saving...' : allPassed ? 'Technical Requirements Met' : 'Acknowledge & Continue'}
      </button>
    </div>
  )
}

function ItemGuidelines({
  saving,
  onComplete,
  candidateAgreed,
  onRequestAgreement,
}: {
  saving: boolean
  onComplete: (d: any) => void
  candidateAgreed?: boolean
  onRequestAgreement?: () => void
}) {
  const [sent, setSent] = useState(false)

  // Send the popup request to the candidate as soon as this step is active.
  useEffect(() => {
    if (sent) return
    onRequestAgreement?.()
    setSent(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-complete the checklist item once the candidate ticks "I Agree" on
  // their side. Proctor still sees the status; no manual button needed.
  useEffect(() => {
    if (candidateAgreed && !saving) {
      onComplete({ value: { agreed: 'yes', by: 'candidate' } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateAgreed])

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '14px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', borderLeft: '3px solid var(--cyan)' }}>
        <p style={{ margin: 0, fontSize: '12px' }}>
          The exam guidelines have been displayed to the candidate. The checklist
          will advance automatically when they tick <strong style={{ color: 'var(--cyan)' }}>"I Agree"</strong>.
        </p>
      </div>
      {!candidateAgreed ? (
        <div style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '6px', fontSize: '13px', color: 'var(--cyan)', textAlign: 'center', marginBottom: '10px' }}>
          ⏳ Waiting for candidate to read & agree...
        </div>
      ) : (
        <div style={{ padding: '10px 12px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '6px', fontSize: '13px', color: 'var(--emerald)', textAlign: 'center', marginBottom: '10px', fontWeight: 600 }}>
          ✓ Candidate agreed to the exam guidelines
        </div>
      )}
      <button className="btn-ghost" style={{ width: '100%', padding: '8px', fontSize: '12px' }}
        onClick={() => onRequestAgreement?.()} disabled={saving}>
        Re-send agreement popup
      </button>
    </div>
  )
}

const INITIAL_STATE: ChecklistState = {
  camera_verified:    'active',
  identity_name:      'pending',
  identity_email:     'pending',
  government_id:      'pending',
  background_scan:    'pending',
  no_materials:       'pending',
  facial_recognition: 'pending',
  screen_share:       'pending',
  guardpro:           'pending',
  guidelines_agreed:  'pending',
}

export default function ChecklistPanel({ sessionId, candidateVideoRef, candidateStream, candidate, onAllDone, onRequestScreenShare, candidateScreenShareActive, onRequestGuidelinesAgreement, candidateAgreedToGuidelines }: Props) {
  // Per-candidate checklist state so switching the active candidate shows
  // that candidate's progress instead of bleeding state across candidates.
  const [perCandidate, setPerCandidate] = useState<Record<string, ChecklistState>>({})
  const candId = candidate?.id || '__single__'
  const itemStates: ChecklistState = perCandidate[candId] || INITIAL_STATE
  const setItemStates = (updater: (prev: ChecklistState) => ChecklistState) => {
    setPerCandidate(prev => ({
      ...prev,
      [candId]: updater(prev[candId] || INITIAL_STATE),
    }))
  }
  const [saving, setSaving] = useState(false)

  // Ensure the active candidate has an initial entry, otherwise the first
  // item never becomes 'active'.
  useEffect(() => {
    setPerCandidate(prev => prev[candId] ? prev : { ...prev, [candId]: { ...INITIAL_STATE } })
  }, [candId])

  useEffect(() => {
    // Lazy-init the ACTIVE candidate's checklist row, then hydrate the
    // local UI state from the backend so the proctor sees previously-
    // completed items as "done" instead of "pending" after switching
    // away and back (or after a page refresh). We only OVERWRITE keys
    // that the backend reports completed — otherwise the local UI
    // status (active/pending) stays put so the next item still
    // highlights correctly.
    if (!candidate?.id) return
    let cancelled = false
    ;(async () => {
      try {
        // init can return 4xx (e.g. proctor opens the panel before the
        // session row exists) — log that to the proctor so they know
        // *why* the checklist is empty instead of silently swallowing.
        try {
          await checklistApi.init(sessionId, candidate.id)
        } catch (initErr: any) {
          // Only surface real failures — 409 ("already exists") is
          // expected on revisits and should stay quiet.
          const status = initErr?.response?.status
          if (status && status !== 409 && status !== 400) {
            toast.error(`Checklist init failed: ${initErr?.response?.data?.message || initErr?.message || status}`)
          }
        }
        const { data } = await checklistApi.get(sessionId, candidate.id)
        if (cancelled) return
        const items = (data?.items as any[]) || []
        const done = new Set(items.filter(i => i.completed).map(i => i.key))
        if (done.size === 0) return
        setItemStates(prev => {
          const next: ChecklistState = { ...prev }
          ITEMS.forEach(it => {
            if (done.has(it.key)) next[it.key] = 'done'
          })
          // First not-done item becomes "active" so the UI doesn't show
          // every row dormant when some are already complete.
          const firstPending = ITEMS.find(it => next[it.key] !== 'done')
          if (firstPending) next[firstPending.key] = 'active'
          return next
        })
      } catch (e: any) {
        // Hydration GET failed — likely 404 if the checklist hasn't
        // been created yet. Tolerate it but log so the proctor knows
        // the panel may be stale.
        if (e?.response?.status && e.response.status !== 404) {
          toast.error(`Checklist hydration failed: ${e?.response?.data?.message || e?.message}`)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, candidate?.id])

  const expectedName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim()
  const expectedEmail = candidate?.email || ''

  const doneCount = ITEMS.filter(i => itemStates[i.key] === 'done').length
  const allDone = doneCount === ITEMS.length

  const completeItem = async (key: ChecklistItemKey, data: Record<string, any> = {}) => {
    setSaving(true)
    try {
      // Tag the call with the candidate this proctor is currently verifying
      // so the backend can emit a candidate-scoped socket event. Without
      // this, every candidate in a multi-candidate slot would see the
      // confirmation pop up on their screen.
      await checklistApi.completeItem(sessionId, key, { ...data, candidateId: candidate?.id })
      const currentIdx = ITEMS.findIndex(i => i.key === key)
      const nextKey = ITEMS[currentIdx + 1]?.key
      setItemStates(prev => ({
        ...prev,
        [key]: 'done',
        ...(nextKey ? { [nextKey]: 'active' } : {}),
      }))
      if (!nextKey) onAllDone()
    } catch {
      toast.error('Failed to save checklist item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Pre-Exam Checklist</h3>
        <span style={{ fontSize: '13px', color: allDone ? 'var(--emerald)' : 'var(--cyan)' }}>{doneCount} / {ITEMS.length} complete</span>
      </div>

      <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', marginBottom: '20px' }}>
        <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${(doneCount / ITEMS.length) * 100}%`, transition: 'width 0.4s' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ITEMS.map((item, idx) => {
          const state = itemStates[item.key]
          const isActive = state === 'active'
          const isDone = state === 'done'

          return (
            <div key={item.key} style={{
              borderRadius: '8px',
              border: `1px solid ${isActive ? 'var(--cyan)' : isDone ? 'rgba(5,150,105,0.3)' : 'var(--border)'}`,
              background: isActive ? 'rgba(0,212,255,0.05)' : isDone ? 'rgba(5,150,105,0.05)' : 'var(--bg-elevated)',
              overflow: 'hidden',
              opacity: state === 'pending' ? 0.5 : 1,
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                <div style={{ flexShrink: 0 }}>
                  {isDone
                    ? <CheckCircle size={18} color="var(--emerald)" />
                    : <Circle size={18} color={isActive ? 'var(--cyan)' : 'var(--text-muted)'} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: isActive ? 'var(--cyan)' : isDone ? 'var(--emerald)' : 'var(--text-secondary)' }}>
                    {idx + 1}. {item.title}
                  </p>
                  {isActive && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{item.description}</p>}
                </div>
                {isDone && <span style={{ fontSize: '11px', color: 'var(--emerald)' }}>Done</span>}
              </div>

              {isActive && item.key === 'camera_verified' && (
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    Confirm the candidate's face is clearly visible, upper body is shown, and surroundings are visible on camera.
                  </div>
                  <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving}
                    onClick={() => completeItem('camera_verified', { value: true })}>
                    {saving ? 'Saving...' : 'Camera Confirmed'}
                  </button>
                </div>
              )}

              {isActive && item.key === 'identity_name' && (
                <ItemIdentityName saving={saving} expectedName={expectedName} onComplete={d => completeItem('identity_name', d)} />
              )}

              {isActive && item.key === 'identity_email' && (
                <ItemIdentityEmail saving={saving} expectedEmail={expectedEmail} onComplete={d => completeItem('identity_email', d)} />
              )}

              {isActive && item.key === 'government_id' && (
                <ItemGovernmentId sessionId={sessionId} candidateId={candidate?.id} candidateStream={candidateStream} saving={saving} onComplete={d => completeItem('government_id', d)} />
              )}

              {isActive && item.key === 'background_scan' && (
                <ItemEnvironmentScan saving={saving} onComplete={d => completeItem('background_scan', d)} />
              )}

              {isActive && item.key === 'no_materials' && (
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Confirm no unauthorized materials, secondary monitors, or other people are visible.
                  </div>
                  <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving}
                    onClick={() => completeItem('no_materials', { value: true })}>
                    {saving ? 'Saving...' : 'No Materials Confirmed'}
                  </button>
                </div>
              )}

              {isActive && item.key === 'facial_recognition' && (
                <ItemFacialRecognition
                  sessionId={sessionId}
                  candidateId={candidate?.id}
                  candidateStream={candidateStream}
                  saving={saving}
                  onComplete={d => completeItem('facial_recognition', d)}
                />
              )}

              {isActive && item.key === 'screen_share' && (
                <ItemScreenShare
                  saving={saving}
                  onComplete={d => completeItem('screen_share', d)}
                  onRequestCandidateScreenShare={onRequestScreenShare}
                  candidateSharing={candidateScreenShareActive}
                />
              )}

              {isActive && item.key === 'guardpro' && (
                <ItemTechCheck saving={saving} onComplete={d => completeItem('guardpro', d)} />
              )}

              {isActive && item.key === 'guidelines_agreed' && (
                <ItemGuidelines
                  saving={saving}
                  candidateAgreed={candidateAgreedToGuidelines}
                  onRequestAgreement={onRequestGuidelinesAgreement}
                  onComplete={d => completeItem('guidelines_agreed', d)}
                />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <button
          className="btn-primary"
          style={{ width: '100%', padding: '12px', opacity: allDone ? 1 : 0.4, cursor: allDone ? 'pointer' : 'not-allowed', fontSize: '15px' }}
          disabled={!allDone}
          onClick={allDone ? onAllDone : undefined}
          title={allDone ? '' : `Complete all ${ITEMS.length} checklist items to begin`}
        >
          {allDone ? 'Begin MCQ Exam' : `Complete all ${ITEMS.length} items to unlock (${doneCount}/${ITEMS.length})`}
        </button>
      </div>
    </div>
  )
}
