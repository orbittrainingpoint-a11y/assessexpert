'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi, proctoringApi, reportsApi } from '@/lib/api'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useSessionWebSocket } from '@/lib/useWebSocket'
import { useJitsi as useLivekit } from '@/lib/useJitsi'
import { useMediaPipe } from '@/lib/useMediaPipe'
import MonitorGrid from '@/components/proctor/MonitorGrid'
import FlagQueue from '@/components/proctor/FlagQueue'
import PracticalPanel, { PostSessionPanel } from '@/components/proctor/PracticalPanel'
import AIMonitoringPanel from '@/components/proctor/AIMonitoringPanel'
import CaptureGallery from '@/components/proctor/CaptureGallery'
import VerificationLayout from '@/components/proctor/VerificationLayout'
import PostVerificationLayout from '@/components/proctor/PostVerificationLayout'

type SessionPhase = 'checklist' | 'mcq' | 'practical' | 'complete'

function SessionContent() {
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const sessionId = searchParams.get('id') || ''

  const [phase, setPhase] = useState<SessionPhase>('checklist')
  const [isPaused, setIsPaused] = useState(false)
  const [resolvedFlagIds, setResolvedFlagIds] = useState<string[]>([])
  const [activeCandidateId, setActiveCandidateId] = useState<string | undefined>()
  // Socket id of the candidate the proctor is currently verifying — used to
  // route the proctor's outbound audio/video to ONLY that candidate. Empty
  // string / undefined means broadcast (e.g. during MCQ monitoring).
  const [activeCandidateSocketId, setActiveCandidateSocketId] = useState<string | undefined>()
  const [verifiedCandidates, setVerifiedCandidates] = useState<Set<string>>(new Set())
  const [mcqPushed, setMcqPushed] = useState(false)
  const [screenSharingCandidateIds, setScreenSharingCandidateIds] = useState<Set<string>>(new Set())
  const [candidateProgress, setCandidateProgress] = useState<Record<string, number>>({})
  const [mcqScores, setMcqScores] = useState<Record<string, { score: number; total: number }>>({}) 

  const { emit: wsEmit, socket: wsSocket } = useSessionWebSocket({
    sessionId,
    role: 'PROCTOR',
    enabled: !!sessionId,
    onEvent: (event, data) => {
      if (event === 'candidate.joined' || event === 'ai.flag') {
        qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
        qc.invalidateQueries({ queryKey: ['session-events', sessionId] })
      }
      if (event === 'candidate.progress') {
        setCandidateProgress(prev => ({
          ...prev,
          [data.candidateId]: data.questionProgress,
        }))
      }
      if (event === 'exam.mcqSubmitted') {
        // Fetch real score immediately
        if (data.candidateId) {
          setMcqScores(prev => ({
            ...prev,
            [data.candidateId]: { score: data.score ?? 0, total: 25 },
          }))
        }
        qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
      }
      if (event === 'session.submitted') {
        qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
      }
      if (event === 'candidate.guidelinesAgreed') {
        toast.success('Candidate agreed to exam guidelines', { duration: 5000 })
      }
      if (event === 'candidate.guidelinesDeclined') {
        toast.error('Candidate DECLINED exam guidelines — session terminated', { duration: 8000 })
        qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
      }
      if (event === 'candidate.screenShareActive') {
        setScreenSharingCandidateIds(prev => {
          const next = new Set(prev)
          // Accept candidateId from event, or fall back to the session's candidate
          const cid = data.candidateId || session?.candidate?.id
          if (cid) next.add(cid)
          return next
        })
      }
      if (event === 'candidate.screenShareStopped') {
        setScreenSharingCandidateIds(prev => {
          const next = new Set(prev)
          const cid = data.candidateId || session?.candidate?.id
          if (cid) next.delete(cid)
          return next
        })
      }

      // Master proctor reassigned this session away from us. If the
      // current user is the one being kicked, leave the page — we no
      // longer have the right to monitor this session and the new
      // proctor will pick it up on their own dashboard.
      if (event === 'proctor.reassigned') {
        const me = user?.id
        if (me && data.previousProctorId === me) {
          toast(
            `Session reassigned${data.newProctorName ? ` to ${data.newProctorName}` : ''}${data.reason ? ` — ${data.reason}` : ''}`,
            { icon: '🔄', duration: 6000 },
          )
          router.push('/proctor/today')
        } else {
          // Not us — could be the new proctor's dashboard. Just refresh
          // the session row so the proctor list reflects the change.
          qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
        }
      }
    },
  })
  // LiveKit replaces our previous getUserMedia + WebRTC P2P stack.
  // We still get a "local" camera stream back from LiveKit for the PIP/preview.
  //
  // Auth: no localStorage token any more — the useJitsi call now sends
  // the httpOnly cookie via credentials:'include'. Gate the connection
  // on `user` (loaded from /auth/me on mount) instead of a token.
  const {
    isConnected: lkConnected,
    localCameraStream: proctorStream,
    peers: lkPeers,
    error: lkError,
  } = useLivekit({
    enabled: !!sessionId && !!user,
    role: 'PROCTOR',
    sessionId,
    publishCamera: true,
    publishMic: true,
    // 1-to-1 routing: only the currently-selected candidate sees + hears the
    // proctor. Only active during the checklist/verification phase — once
    // the exam starts, the proctor broadcasts to all candidates again.
    activeTargetSocketId: phase === 'checklist' ? activeCandidateSocketId : undefined,
    socket: wsSocket,
  })

  const { alerts, behaviorScore, isMonitoring, dismissAlert } = useMediaPipe({
    sessionId,
    socket: wsSocket,
    enabled: !!sessionId && !!wsSocket,
    onAlert: (alert) => {
      if (alert.severity === 'critical') {
        toast.error(alert.message, { duration: 5000 })
      }
    },
  })

  const { data: session, isLoading } = useQuery({
    queryKey: ['proctor-session', sessionId],
    queryFn: () => sessionsApi.getOne(sessionId).then(r => r.data),
    enabled: !!sessionId,
    refetchInterval: 10000,
  })

  // Every session is treated as multi-candidate now (N may be 1). The
  // SessionCandidate rows are the single source of truth for who is in
  // the slot — no more branching on isMultiCandidate.
  const { data: sessionCandidates } = useQuery({
    queryKey: ['session-candidates', sessionId],
    queryFn: () => fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions/${sessionId}/candidates`, {
      credentials: 'include',
    }).then(r => r.json()),
    enabled: !!sessionId,
    refetchInterval: 5000,
  })

  const { data: events } = useQuery({
    queryKey: ['session-events', sessionId],
    queryFn: () => proctoringApi.getEvents(sessionId).then(r => r.data),
    enabled: !!sessionId,
    refetchInterval: 5000,
  })

  const candidateVideoRef = useRef<HTMLVideoElement | null>(null)

  // Convert LiveKit peers into a Map<identity, MediaStream> compatible with old code
  // so we don't have to rewrite VerificationLayout and MonitorGrid.
  const remoteStreams = new Map<string, MediaStream>()
  lkPeers.forEach((peer, identity) => {
    if (peer.role === 'CANDIDATE' && peer.cameraStream) {
      remoteStreams.set(identity, peer.cameraStream)
    }
  })

  const handleCandidateSelect = useCallback((candidateId: string, candidateSocketId?: string) => {
    if (activeCandidateId === candidateId) {
      setActiveCandidateId(undefined)
      setActiveCandidateSocketId(undefined)
      if (wsSocket?.connected) {
        wsSocket.emit('proctor.leaveVerification', { sessionId, candidateId, candidateSocketId })
      }
    } else {
      setActiveCandidateId(candidateId)
      setActiveCandidateSocketId(candidateSocketId)
      if (wsSocket?.connected) {
        wsSocket.emit('proctor.enterVerification', { sessionId, candidateId, candidateSocketId })
      }
    }
  }, [activeCandidateId, sessionId, wsSocket])

  const handleAllVerified = useCallback(() => {
    if (wsSocket?.connected) {
      wsSocket.emit('proctor.allVerified', { sessionId })
    }
    // Move to MCQ phase so PostVerificationLayout renders. The actual
    // `sessionsApi.begin` + `exam.pushMCQ` socket emit happens ONLY when
    // the proctor clicks "Push MCQ" inside that layout — that's the
    // deliberate handoff between verification and the exam clock
    // starting. Do NOT pre-set mcqPushed here or the button lands
    // already-disabled and the proctor can never trigger begin(),
    // leaving every candidate stuck at the verification screen and
    // Push Practical greyed out forever.
    setPhase('mcq')
  }, [sessionId, wsSocket])

  const handlePushMCQ = useCallback(async () => {
    try {
      // Begin the session in DB so candidates can load MCQ questions
      await sessionsApi.begin(sessionId)
    } catch (e: any) {
      // If already started, ignore
      if (!e.response?.data?.message?.toLowerCase().includes('already')) {
        toast.error(e.response?.data?.message || 'Failed to begin exam')
        return
      }
    }
    if (wsSocket?.connected) {
      wsSocket.emit('exam.pushMCQ', { sessionId })
    }
    setMcqPushed(true)
    qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
    toast.success('MCQ pushed to all candidates')
  }, [sessionId, wsSocket, qc])

  const handlePushPractical = useCallback(() => {
    if (wsSocket?.connected) {
      wsSocket.emit('exam.pushPractical', { sessionId })
    }
    toast.success('Practical pushed to all candidates')
  }, [sessionId, wsSocket])

  const handleDisqualify = useCallback((candidateId: string) => {
    const reason = prompt('Reason for disqualification?')
    if (reason && wsSocket?.connected) {
      wsSocket.emit('candidate.disqualified', { sessionId, candidateId, reason })
      toast.success('Candidate disqualified')
    }
  }, [sessionId, wsSocket])

  useEffect(() => {
    if (!session) return
    const s = session.status
    if (s === 'MCQ_IN_PROGRESS') setPhase('mcq')
    else if (['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'].includes(s)) setPhase('mcq')
    else if (s === 'PRACTICAL_IN_PROGRESS') setPhase('practical')
    else if (['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED'].includes(s)) setPhase('complete')
    else setPhase('checklist')
  }, [session?.status])

  // Keep the active candidate's socketId in sync with the live peer map.
  // When the proctor selects a candidate tile BEFORE the WebRTC peer is
  // established (which happens often — auto-select fires on the first
  // render, but the peer connection takes 500ms+ to set up), the socketId
  // captured at click time is undefined. Once useJitsi establishes the
  // peer and rebuilds lkPeers, we pull the real socketId out and update
  // the active target so the 1-to-1 audio routing actually targets the
  // right connection during verification.
  useEffect(() => {
    if (!activeCandidateId) return
    // Try the strict map key first, then scan every candidate peer by the
    // parsed candidateId. The scan recovers in the brief window before the
    // identity-upgrade in useJitsi runs (offer arrived before peer.joined
    // brought the real candidateId). Without it the proctor's selection
    // never gets a socketId → 1-to-1 routing silently broadcasts to all.
    const direct = lkPeers.get(`candidate-${activeCandidateId}`)
    const scanned = direct || Array.from(lkPeers.values()).find(
      (p: any) => p.role === 'CANDIDATE' && p.candidateId === activeCandidateId,
    )
    if (scanned?.socketId && scanned.socketId !== activeCandidateSocketId) {
      setActiveCandidateSocketId(scanned.socketId)
      // Re-emit activation to backend now that we have the real socketId.
      // The initial handleCandidateSelect likely fired with undefined
      // socketId, so the server never set up the audio routing.
      if (phase === 'checklist' && wsSocket?.connected) {
        wsSocket.emit('proctor.enterVerification', {
          sessionId,
          candidateId: activeCandidateId,
          candidateSocketId: scanned.socketId,
        })
      }
    }
  }, [activeCandidateId, lkPeers, activeCandidateSocketId, phase, sessionId, wsSocket])

  const pauseMutation = useMutation({
    mutationFn: () => sessionsApi.pause(sessionId),
    onSuccess: () => { setIsPaused(true); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => sessionsApi.resume(sessionId),
    onSuccess: () => { setIsPaused(false); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const terminateMutation = useMutation({
    mutationFn: (reason: string) => sessionsApi.terminate(sessionId, reason),
    onSuccess: () => { toast.success('Session terminated'); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  if (!sessionId) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>No session selected.</p>
      <Link href="/proctor/today" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 24px' }}>View Today's Sessions →</Link>
    </div>
  )

  if (isLoading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading session...</div>
  if (!session) return <div style={{ color: 'var(--rose)', padding: '40px' }}>Session not found.</div>

  const candidate = session.candidate
  const candidateStream: MediaStream | null = remoteStreams.size > 0 ? (Array.from(remoteStreams.values())[0] as MediaStream) : null
  const candidatePeer = Array.from(lkPeers.values()).find(p => p.role === 'CANDIDATE')
  const candidateScreenStream = candidatePeer?.screenStream || null
  // The lkPeers Map carries the real socket.io socketId now (added to
  // RemotePeer). Falling back to the first candidate peer's socketId
  // keeps single-candidate sessions working when the SessionCandidate
  // lookup misses (e.g. the candidate just connected and lkPeers is
  // still keyed by `candidate-${socketId}` until the next rebuild).
  const fallbackSocketId = candidatePeer?.socketId

  // Unified candidate list — always derived from SessionCandidate rows
  // when available. The fallback to `[session.candidate]` covers the
  // brief window between page load and the first sessionCandidates fetch,
  // plus any legacy session that pre-dates the backfill migration.
  // A "single slot" is one candidate (or the pre-fetch fallback). Only
  // then is it safe to fall back to the lone shared stream; in a
  // multi-candidate slot we must NEVER reuse another candidate's stream.
  const isSingleSlot = !sessionCandidates || sessionCandidates.length <= 1
  const candidates =
    sessionCandidates && sessionCandidates.length > 0
      ? sessionCandidates.map((sc: any) => {
          // Match THIS candidate's peer strictly by their database id —
          // first by the exact map key, then by the candidateId parsed
          // onto any candidate peer. The previous `|| candidateStream`
          // fallback made every tile show the FIRST candidate whenever a
          // lookup missed — the "same person in every screen" bug. We now
          // only fall back to the shared stream for a true single-candidate
          // slot; in a multi slot an unmatched tile shows no stream
          // ("connecting") instead of the wrong person.
          const peer =
            lkPeers.get(`candidate-${sc.candidateId}`) ||
            Array.from(lkPeers.values()).find(
              (p: any) => p.role === 'CANDIDATE' && p.candidateId === sc.candidateId,
            )
          return {
            id: sc.candidateId,
            name: `${sc.candidate.firstName} ${sc.candidate.lastName}`,
            firstName: sc.candidate.firstName,
            lastName: sc.candidate.lastName,
            email: sc.candidate.email,
            stream: peer?.cameraStream || (isSingleSlot ? candidateStream : null),
            screenStream: peer?.screenStream || (isSingleSlot ? candidateScreenStream : null),
            socketId: peer?.socketId || (isSingleSlot ? fallbackSocketId : undefined),
            mcqSubmitted: sc.status === 'MCQ_SUBMITTED',
          }
        })
      : [{
          id: candidate?.id || sessionId,
          name: `${candidate?.firstName} ${candidate?.lastName}`,
          firstName: candidate?.firstName,
          lastName: candidate?.lastName,
          email: candidate?.email,
          stream: candidateStream,
          screenStream: candidateScreenStream,
          socketId: fallbackSocketId,
          mcqSubmitted: session.status === 'MCQ_SUBMITTED',
        }]

  // After the checklist→VERIFIED wiring, SessionCandidate.status is the
  // single source of truth. A candidate counts as verified the moment
  // their proctor checklist completes (status flips to VERIFIED or any
  // later phase). Fallback to the local `verifiedCandidates` set covers
  // the brief load gap before sessionCandidates arrives.
  const allVerified =
    sessionCandidates && sessionCandidates.length > 0
      ? sessionCandidates.every((sc: any) =>
          ['VERIFIED', 'MCQ_IN_PROGRESS', 'MCQ_SUBMITTED', 'PRACTICAL_IN_PROGRESS', 'PRACTICAL_SUBMITTED', 'COMPLETED'].includes(sc.status),
        )
      : verifiedCandidates.size > 0

  const allMcqSubmitted =
    sessionCandidates && sessionCandidates.length > 0
      ? sessionCandidates.every((sc: any) => sc.status === 'MCQ_SUBMITTED' || sc.status === 'PRACTICAL_IN_PROGRESS' || sc.status === 'PRACTICAL_SUBMITTED' || sc.status === 'COMPLETED')
      : session.status === 'MCQ_SUBMITTED'
    
  const allEvents: any[] = Array.isArray(events) ? events : []
  const activeFlags = allEvents.filter(
    e => (e.severity === 'CRITICAL' || e.severity === 'WARNING') && !resolvedFlagIds.includes(e.id)
  )

  // Practical-phase MonitorGrid tiles — same source as the unified
  // candidate list above, so N=1 and N>1 render identically.
  const candidateTiles = candidates.map((c: any) => ({
    id: c.id,
    firstName: c.firstName || 'Candidate',
    lastName: c.lastName || '',
    questionProgress: candidateProgress[c.id] ?? 0,
    totalQuestions: session.assessmentType?.mcqCount || 25,
    faceStatus: 'present' as const,
    screenStatus: screenSharingCandidateIds.has(c.id) ? 'active' as const : 'issue' as const,
    submittedPractical: c.mcqSubmitted || session.status === 'SUBMITTED',
    stream: c.stream,
    screenStream: c.screenStream,
  }))

  // Prefer the live socket score, then the backend's computed correctCount, then
  // fall back to answers length / 0. This makes the submission view correct
  // even after a page refresh when the live event was missed.
  const mcqTotal: number = session.mcqTotal ?? session.assessmentType?.mcqCount ?? 25
  const liveScore = mcqScores[candidate?.id]?.score
  const dbScore = typeof session.mcqCorrectCount === 'number' ? session.mcqCorrectCount : undefined
  const fallbackScore = session.answers?.filter((a: any) => a.isCorrect).length
  const proctorScore = liveScore ?? dbScore ?? fallbackScore ?? 0
  const passThreshold = Math.ceil(mcqTotal * 0.6)
  const mcqResults = [{
    candidateId: candidate?.id || '',
    candidateName: `${candidate?.firstName} ${candidate?.lastName}`,
    score: proctorScore,
    total: mcqTotal,
    passed: proctorScore >= passThreshold,
  }]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Live Session — {candidate?.firstName} {candidate?.lastName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {session.assessmentType?.name} · Phase: <strong style={{ color: 'var(--cyan)', textTransform: 'capitalize' }}>{phase}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`badge ${['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'].includes(session.status) ? 'badge-live' : session.status === 'REPORT_PUBLISHED' ? 'badge-pass' : 'badge-pending'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
            {session.status.replace(/_/g, ' ')}
          </span>
          {['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'WAITING_ROOM', 'CHECKLIST'].includes(session.status) && (
            <button className="btn-ghost" onClick={() => { const r = prompt('Reason for termination?'); if (r) terminateMutation.mutate(r) }}
              style={{ fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)', padding: '6px 12px' }}>
              <AlertTriangle size={13} style={{ display: 'inline', marginRight: '4px' }} />Terminate
            </button>
          )}
        </div>
      </div>

      {phase === 'checklist' && (
        <VerificationLayout
          sessionId={sessionId}
          candidates={candidates}
          proctorStream={proctorStream}
          onCandidateSelect={handleCandidateSelect}
          onAllVerifiedClick={handleAllVerified}
          allVerified={allVerified}
          socket={wsSocket}
          screenSharingCandidateIds={screenSharingCandidateIds}
        />
      )}

      {phase === 'mcq' && !['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'].includes(session.status) && (
        <PostVerificationLayout
          sessionId={sessionId}
          candidates={candidates.map((c: any) => ({ ...c, screenStream: c.screenStream || c.stream, cameraStream: c.stream }))}
          proctorStream={proctorStream}
          onPushMCQ={handlePushMCQ}
          onPushPractical={handlePushPractical}
          onDisqualify={handleDisqualify}
          mcqPushed={mcqPushed}
          allMcqSubmitted={allMcqSubmitted}
        />
      )}

      {phase === 'mcq' && ['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'].includes(session.status) && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <PracticalPanel sessionId={sessionId} assessmentTypeId={session.assessmentTypeId} mcqResults={mcqResults} onPracticalStarted={() => { setPhase('practical'); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <AIMonitoringPanel alerts={alerts} behaviorScore={behaviorScore} isMonitoring={isMonitoring} onDismissAlert={dismissAlert} />
            <CaptureGallery sessionId={sessionId} enabled={phase === 'mcq'} />
            <FlagQueue flags={activeFlags} onFlagActioned={id => setResolvedFlagIds(p => [...p, id])} />
          </div>
        </div>
      )}

      {phase === 'practical' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <MonitorGrid sessionId={sessionId} candidates={candidateTiles} phase="practical" onPause={() => pauseMutation.mutate()} onResume={() => resumeMutation.mutate()} isPaused={isPaused} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <AIMonitoringPanel alerts={alerts} behaviorScore={behaviorScore} isMonitoring={isMonitoring} onDismissAlert={dismissAlert} />
            <CaptureGallery sessionId={sessionId} enabled={phase === 'practical'} />
            <FlagQueue flags={activeFlags} onFlagActioned={id => setResolvedFlagIds(p => [...p, id])} />
          </div>
        </div>
      )}

      {phase === 'complete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PostSessionPanel sessionId={sessionId} endedAt={session.endedAt || new Date().toISOString()} candidateCount={1} />
          {session.status === 'PENDING_PROCTOR_REVIEW' && (
            <div style={{ textAlign: 'center' }}>
              <Link href={`/proctor/reports/${sessionId}`} className="btn-primary" style={{ textDecoration: 'none', padding: '12px 32px', fontSize: '15px' }}>
                Review & Publish Report →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProctorSessionPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>}>
      <SessionContent />
    </Suspense>
  )
}
