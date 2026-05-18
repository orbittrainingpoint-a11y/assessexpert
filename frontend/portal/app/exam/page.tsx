'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { authApi, examApi, checklistApi, legalApi, transcriptApi, api, uploadUrl } from '@/lib/api'
import { useSpeechTranscription } from '@/lib/useSpeechTranscription'
import { useSessionWebSocket } from '@/lib/useWebSocket'
import { useJitsi as useLivekit } from '@/lib/useJitsi'
import { useFaceDetection } from '@/lib/useFaceDetection'
import CandidateVerificationLayout from '@/components/candidate/CandidateVerificationLayout'
import GuidelinesModal from '@/components/candidate/GuidelinesModal'
import PracticalSetView from '@/components/candidate/PracticalSetView'
import toast from 'react-hot-toast'
import { Shield, Monitor, RefreshCw, XCircle, Clock } from 'lucide-react'

type Phase = 
  | 'verifying-link' 
  | 'link-expired' 
  | 'not-open' 
  | 'otp-email' 
  | 'otp-verify' 
  | 'camera' 
  | 'verification'
  | 'waiting' 
  | 'mcq' 
  | 'mcq-complete' 
  | 'practical' 
  | 'complete' 
  | 'terminated' 
  | 'connection-lost'

function ExamContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [phase, setPhase] = useState<Phase>('verifying-link')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sessionState, setSessionState] = useState<any>(null)
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [practicalTask, setPracticalTask] = useState<any>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  
  // OTP States
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', ''])
  const [otpAttempts, setOtpAttempts] = useState(0)
  const [resendTimer, setResendTimer] = useState(0)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Legal content: fetched live from the public endpoint, displayed in modals
  // on the OTP screen. The candidate must tick the agreement checkbox before
  // they can submit the OTP.
  const [legalContent, setLegalContent] = useState<{ termsAndConditions: string; privacyPolicy: string } | null>(null)
  const [legalAgreed, setLegalAgreed] = useState(false)
  const [legalView, setLegalView] = useState<null | 'terms' | 'privacy'>(null)

  useEffect(() => {
    let cancelled = false
    legalApi.getPublic()
      .then(r => { if (!cancelled) setLegalContent(r.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // UI States
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [aiWarning, setAiWarning] = useState<{ message: string; type: 'warning' | 'critical' } | null>(null)
  const [checklist, setChecklist] = useState<any[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const bgVideoRef = useRef<HTMLVideoElement>(null)
  // We retain a copy of the LiveKit local camera stream for legacy refs (preview/face detection)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  // Helper: assign stream to any video element
  const assignStream = useCallback((el: HTMLVideoElement | null) => {
    if (!el || !cameraStreamRef.current) return
    if (el.srcObject !== cameraStreamRef.current) {
      el.srcObject = cameraStreamRef.current
    }
    el.play().catch(() => {})
  }, [])

  // Re-assign stream whenever phase changes (new video element mounts)
  useEffect(() => {
    if (!cameraStreamRef.current) return
    const timer = setTimeout(() => {
      assignStream(videoRef.current)
      assignStream(bgVideoRef.current)
    }, 50)
    return () => clearTimeout(timer)
  }, [phase, assignStream])

  // Re-assign stream after fullscreen change (browser pauses video during transition)
  useEffect(() => {
    const onFs = () => {
      setTimeout(() => {
        assignStream(videoRef.current)
        assignStream(bgVideoRef.current)
      }, 200)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [assignStream])

  // WebSocket real-time connection
  const { emit: wsEmit, socket: wsSocket } = useSessionWebSocket({
    sessionId: sessionState?.id || '',
    role: 'CANDIDATE',
    enabled: !!sessionState?.id && (phase === 'verification' || phase === 'waiting' || phase === 'mcq' || phase === 'practical'),
    onEvent: (event, data) => {
      if (event === 'session.phase') {
        if (data.phase === 'MCQ_IN_PROGRESS') {
          loadNextQuestion().then(() => setPhase('mcq'))
        } else if (data.phase === 'PRACTICAL_IN_PROGRESS') {
          if (data.practicalTask) setPracticalTask(data.practicalTask)
          setPhase('practical')
        } else if (data.phase === 'TERMINATED') {
          setPhase('terminated')
        }
      }
      if (event === 'exam.pushMCQ') {
        loadNextQuestion().then(() => setPhase('mcq'))
      }
      if (event === 'exam.pushPractical') {
        if (data.practicalTask) setPracticalTask(data.practicalTask)
        setPhase('practical')
      }
      if (event === 'candidate.disqualified') {
        setPhase('terminated')
        toast.error('You have been disqualified from this assessment')
      }
      if (event === 'checklist.update' || event === 'checklist.itemUpdated') {
        // In multi-candidate slots the event is broadcast to the whole
        // session room. Ignore it if it's for a DIFFERENT candidate so the
        // wrong person doesn't get a screen-share request or terms popup.
        const targetCandidateId = data.candidateId
        const myCandidateId = sessionState?.candidate?.id
        if (targetCandidateId && myCandidateId && targetCandidateId !== myCandidateId) {
          return
        }

        const itemKey = data.itemKey || data.itemId
        const status = data.status
        setChecklist((prev: any[]) => {
          const exists = prev.find(i => i.key === itemKey)
          if (exists) return prev.map(item => item.key === itemKey ? { ...item, status } : item)
          // Add new item if not in list
          return [...prev, { key: itemKey, status, title: itemKey.replace(/_/g, ' ') }]
        })
        // Screen share request from proctor via checklist
        if ((itemKey === 'screen_share' || itemKey === 'ITEM_5_SCREEN_SHARE') && status === 'active') {
          setScreenShareRequested(true)
        }
        // Guidelines & Agreement — proctor reached this step, show the modal.
        // (Skip if this browser already agreed in a prior session.)
        if (itemKey === 'guidelines_agreed' && status === 'active' && !guidelinesAgreed) {
          setGuidelinesOpen(true)
        }
      }
      if (event === 'proctor.message') {
        setAiWarning({ message: data.message, type: 'warning' })
        setTimeout(() => setAiWarning(null), 15000)
      }
      if (event === 'session.pause') {
        if (data.paused) setAiWarning({ message: 'â¸ Session paused by proctor. Please wait.', type: 'warning' })
        else setAiWarning(null)
      }
      if (event === 'disconnect' || event === 'connect_error') {
        // Connection lost handled by isOnline state
      }
    },
  })
  // LiveKit handles all media — publishes candidate camera + mic, receives proctor stream.
  // Enabled once we have a session + we're past the camera check screen.
  // IMPORTANT: 'mcq-complete' must be included so the WebRTC connection does
  // NOT tear down between MCQ submission and the proctor pushing practical.
  // Without it the candidate's camera and screen share both stop and the
  // proctor loses visibility right when the candidate is most idle.
  const livekitEnabled = !!sessionState?.id && (
    phase === 'verification' ||
    phase === 'waiting' ||
    phase === 'mcq' ||
    phase === 'mcq-complete' ||
    phase === 'practical'
  )
  const {
    localCameraStream: lkLocalCamera,
    localScreenStream: lkLocalScreen,
    peers: lkPeers,
    startScreenShare: lkStartScreenShare,
    screenShareActive: lkScreenShareActive,
  } = useLivekit({
    enabled: livekitEnabled,
    role: 'CANDIDATE',
    magicToken: token,
    // Resolved at OTP verification — for multi-candidate slots this lets each
    // browser identify as a UNIQUE WebRTC peer instead of all collapsing
    // onto the primary candidate's identity.
    candidateId: sessionState?.candidate?.id,
    publishCamera: true,
    publishMic: true,
    socket: wsSocket,
  })

  // Keep cameraStreamRef in sync with LiveKit so existing UI refs still work
  useEffect(() => {
    cameraStreamRef.current = lkLocalCamera
    if (lkLocalCamera && !cameraReady) setCameraReady(true)
    // Re-assign to any mounted preview videos
    setTimeout(() => { assignStream(videoRef.current); assignStream(bgVideoRef.current) }, 50)
  }, [lkLocalCamera])

  // Find proctor stream from LiveKit peers
  const proctorPeer = Array.from(lkPeers.values()).find(p => p.role === 'PROCTOR')
  const proctorStream = proctorPeer?.cameraStream || null
  const proctorActive = !!proctorStream

  // Client-side MediaPipe face detection — runs locally on candidate video, emits
  // ai.multiple_faces / ai.face_absent socket events the proctor sees in real time.
  const faceDetectionEnabled = !!sessionState?.id && cameraReady && (phase === 'mcq' || phase === 'practical' || phase === 'verification' || phase === 'waiting')
  useFaceDetection({
    enabled: faceDetectionEnabled,
    stream: lkLocalCamera,
    socket: wsSocket,
    sessionId: sessionState?.id || '',
    candidateId: sessionState?.candidate?.id,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Initial Link Verification
  useEffect(() => {
    if (!token) {
      setPhase('link-expired')
      return
    }

    const verify = async () => {
      try {
        const { data } = await authApi.verifyMagicLink(token)

        // If a previous OTP in this browser resolved a specific candidate
        // (multi-candidate slot), restore that identity instead of falling
        // back to the slot's primary candidate. This survives refreshes.
        let resolved = data
        try {
          const savedId = typeof window !== 'undefined' ? localStorage.getItem(`assessexpert.candidateId.${token}`) : null
          if (savedId && data.sessionCandidates?.length) {
            const match = data.sessionCandidates.find((sc: any) => sc.candidate?.id === savedId)
            if (match) {
              resolved = { ...data, candidate: match.candidate }
            }
          }
        } catch {}
        setSessionState(resolved)

        const activeStatuses = ['WAITING_ROOM', 'CHECKLIST', 'MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'MCQ_COMPLETE']
        const doneStatuses = ['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'COMPLETED', 'DISQUALIFIED']

        if (doneStatuses.includes(data.status)) {
          setPhase('link-expired')
        } else {
          // In a multi-candidate slot, multiple people share this link — DON'T
          // pre-fill the email, every candidate must enter their own.
          // For a single-candidate session, pre-filling is a convenience.
          const isMulti = !!data.isMultiCandidate
          const prefill = isMulti ? '' : (data.candidate?.email || '')

          if (activeStatuses.includes(data.status)) {
            setPhase('otp-email')
            setEmail(prefill)
          } else {
            const now = new Date()
            const scheduled = new Date(data.scheduledAt)
            const diffMinutes = (scheduled.getTime() - now.getTime()) / (1000 * 60)
            if (diffMinutes > 60) {
              setPhase('not-open')
            } else {
              setPhase('otp-email')
              setEmail(prefill)
            }
          }
        }
      } catch (err: any) {
        setPhase('link-expired')
      }
    }
    verify()
  }, [token])

  // Not Open Auto-refresh
  useEffect(() => {
    if (phase !== 'not-open') return
    const interval = setInterval(() => window.location.reload(), 60000)
    return () => clearInterval(interval)
  }, [phase])

  // Resend OTP Timer
  useEffect(() => {
    if (resendTimer > 0) {
      resendIntervalRef.current = setInterval(() => setResendTimer(t => t - 1), 1000)
    } else {
      clearInterval(resendIntervalRef.current)
    }
    return () => clearInterval(resendIntervalRef.current)
  }, [resendTimer])

  // Camera permission pre-check — actual publishing happens via LiveKit later.
  // We only do this to verify the browser permission state before entering the waiting room.
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      // Stop these temporary tracks — LiveKit will acquire its own via setCameraEnabled.
      stream.getTracks().forEach(t => t.stop())
      return true
    } catch {
      toast.error('Camera access required. Please allow camera access and try again.')
      return false
    }
  }, [])

  // Timer sync
  useEffect(() => {
    if (phase !== 'mcq' && phase !== 'practical') return
    const sync = async () => {
      try {
        const { data } = await examApi.getTimer(token)
        setTimeRemaining(data.remaining)
        if (data.remaining <= 0) {
          if (phase === 'mcq') setPhase('mcq-complete')
          else if (phase === 'practical') setPhase('complete')
        }
      } catch {}
    }
    sync()
    timerRef.current = setInterval(() => {
      setTimeRemaining(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          if (phase === 'mcq') setPhase('mcq-complete')
          else setPhase('complete')
          return 0
        }
        return t - 1
      })
    }, 1000)
    const serverSync = setInterval(sync, 30000)
    return () => { clearInterval(timerRef.current); clearInterval(serverSync) }
  }, [phase, token])

  // Connection Monitoring
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  // Tab switch detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && (phase === 'mcq' || phase === 'practical')) {
        setAiWarning({ message: 'âš ï¸ You must not switch browser tabs during the assessment. This event has been recorded.', type: 'critical' })
        setTimeout(() => setAiWarning(null), 10000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [phase])

  // Clipboard block + right-click disable
  useEffect(() => {
    const block = (e: ClipboardEvent) => { if (phase === 'mcq' || phase === 'practical') e.preventDefault() }
    const blockCtx = (e: MouseEvent) => { if (phase === 'mcq' || phase === 'practical') e.preventDefault() }
    document.addEventListener('copy', block)
    document.addEventListener('paste', block)
    document.addEventListener('cut', block)
    document.addEventListener('contextmenu', blockCtx)
    return () => {
      document.removeEventListener('copy', block)
      document.removeEventListener('paste', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('contextmenu', blockCtx)
    }
  }, [phase])

  // Fullscreen Enforcement
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      // Re-assign camera stream after fullscreen transition
      setTimeout(() => assignStream(videoRef.current), 200)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [assignStream])

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      toast.error('Fullscreen failed. Please enable manually.')
    }
  }

  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const [guidelinesAgreed, setGuidelinesAgreed] = useState(false)
  const [screenShareRequested, setScreenShareRequested] = useState(false)

  // Restore the agreed flag from a previous OTP'd browser tab so the popup
  // doesn't re-prompt across refreshes. We DON'T auto-open the modal here —
  // the proctor triggers it when their checklist reaches `guidelines_agreed`.
  useEffect(() => {
    if (!token) return
    const storageKey = `assessexpert.agreed.${token}`
    const already = typeof window !== 'undefined' && localStorage.getItem(storageKey) === '1'
    if (already) setGuidelinesAgreed(true)
  }, [token])

  const handleGuidelinesAgree = useCallback(() => {
    if (typeof window !== 'undefined' && token) {
      localStorage.setItem(`assessexpert.agreed.${token}`, '1')
    }
    setGuidelinesAgreed(true)
    setGuidelinesOpen(false)
    toast.success('Agreement recorded — your exam will start shortly')
    if (wsSocket?.connected && sessionState?.id) {
      wsSocket.emit('candidate.guidelinesAgreed', {
        sessionId: sessionState.id,
        candidateId: sessionState.candidate?.id,
        agreedAt: new Date().toISOString(),
      })
    }
  }, [token, wsSocket, sessionState?.id, sessionState?.candidate?.id])

  // Pre-exam verification transcription — the candidate's side of the
  // conversation. Only runs in the verification/waiting phases (silent
  // during MCQ / practical / completion).
  useSpeechTranscription({
    enabled: (phase === 'verification' || phase === 'waiting') && !!token,
    onUtterance: (text) => {
      transcriptApi.appendAsCandidate(token, {
        candidateId: sessionState?.candidate?.id,
        text,
        timestamp: new Date().toISOString(),
      }).catch(() => {})
    },
  })

  const handleGuidelinesDecline = useCallback(() => {
    if (wsSocket?.connected && sessionState?.id) {
      wsSocket.emit('candidate.guidelinesDeclined', {
        sessionId: sessionState.id,
        candidateId: sessionState.candidate?.id,
        declinedAt: new Date().toISOString(),
      })
    }
    setGuidelinesOpen(false)
    setPhase('terminated')
  }, [wsSocket, sessionState?.id, sessionState?.candidate?.id])

  // Poll for practical phase transition (mcq-complete → practical)
  useEffect(() => {
    if (phase !== 'mcq-complete') return
    const poll = setInterval(async () => {
      try {
        const { data: s } = await examApi.getSession(token)
        // Persist the fresh session — without this, sessionState.practicalPaperSetId
        // stays null and the candidate falls through to the legacy drag-and-drop
        // UI instead of the new PracticalSetView with questions + reference files.
        setSessionState((prev: any) => ({ ...(prev || {}), ...s, id: s.id || s.sessionId || prev?.id }))
        if (s.status === 'PRACTICAL_IN_PROGRESS') {
          clearInterval(poll)
          if (s.practicalTask) {
            setPracticalTask(s.practicalTask)
          } else if (!s.practicalPaperSetId && !s.practicalPaperSet) {
            // No paper-set assigned AND no legacy task — only try the legacy
            // task endpoint as a fallback. Paper sets are loaded inside
            // PracticalSetView via the by-token endpoint.
            try {
              const { data: taskData } = await examApi.getPracticalTask(token)
              setPracticalTask(taskData)
            } catch {
              setPracticalTask({ title: 'Practical Task', description: "Please follow the proctor's instructions." })
            }
          }
          setPhase('practical')
        } else if (['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'COMPLETED'].includes(s.status)) {
          clearInterval(poll)
          setPhase('complete')
        }
      } catch {}
    }, 3000)
    return () => clearInterval(poll)
  }, [phase, token])

  // Checklist Polling — uses public by-token endpoint (no JWT needed)
  // Polls during verification/waiting as fallback; real-time updates come via socket
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'verification') return
    const poll = async () => {
      try {
        const { data } = await api.get(`/checklist/by-token?token=${token}`)
        const items = data.items || []
        // Normalise to { key, status, title } shape so layout renders correctly
        const normalised = items.map((i: any) => ({
          key: i.key,
          title: i.label || i.title || i.key.replace(/_/g, ' '),
          status: i.completed ? 'done' : (i.status || 'pending'),
        }))
        setChecklist(normalised)
      } catch {}
    }
    const interval = setInterval(poll, 3000)
    poll()
    return () => clearInterval(interval)
  }, [phase, token])

  const requestScreenShare = async () => {
    const ok = await lkStartScreenShare()
    if (ok) {
      setScreenShareRequested(false)
      toast.success('Screen share active')
      // Notify proctor via socket so their checklist auto-confirms
      if (wsSocket?.connected && sessionState?.id) {
        wsSocket.emit('candidate.screenShareActive', {
          sessionId: sessionState.id,
          candidateId: sessionState.candidate?.id,
        })
      }
    } else {
      toast.error('Screen share required for this assessment')
    }
  }

  // Notify proctor when screen share starts or stops
  // Only emit 'stopped' if it was previously active (avoid false stop on mount)
  const prevScreenShareRef = useRef(false)
  useEffect(() => {
    if (!wsSocket?.connected || !sessionState?.id) return
    if (lkScreenShareActive) {
      prevScreenShareRef.current = true
      wsSocket.emit('candidate.screenShareActive', {
        sessionId: sessionState.id,
        candidateId: sessionState.candidate?.id,
      })
    } else if (prevScreenShareRef.current) {
      prevScreenShareRef.current = false
      wsSocket.emit('candidate.screenShareStopped', {
        sessionId: sessionState.id,
        candidateId: sessionState.candidate?.id,
      })
    }
  }, [lkScreenShareActive, wsSocket, sessionState?.id, sessionState?.candidate?.id])

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otpArray]
    newOtp[index] = value.slice(-1)
    setOtpArray(newOtp)

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.sendOtp(email, token)
      setPhase('otp-verify')
      setResendTimer(60)
      if (data?.devOtp) {
        setDevOtp(data.devOtp)
        toast.success('Dev mode: OTP shown below')
      } else {
        toast.success('Verification code sent to your email')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send code')
    } finally { setLoading(false) }
  }

  const handleResendOtp = async () => {
    if (resendTimer > 0) return
    setLoading(true)
    try {
      await authApi.sendOtp(email, token)
      setResendTimer(60)
      toast.success('New verification code sent')
    } catch (err: any) {
      toast.error('Failed to resend code')
    } finally { setLoading(false) }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalOtp = otpArray.join('')
    if (finalOtp.length < 6) return

    setLoading(true)
    try {
      // Pass the session token so the backend resolves WHICH candidate just
      // verified (the magic link can belong to multiple candidates).
      const { data: result } = await authApi.verifyOtp(email, finalOtp, token)

      // Persist the resolved candidate identity so subsequent calls
      // (WebRTC token, exam delivery) know which candidate this browser is.
      if (result?.candidateId) {
        try {
          localStorage.setItem(`assessexpert.candidateId.${token}`, result.candidateId)
          localStorage.setItem(`assessexpert.candidateEmail.${token}`, result.candidateEmail || email)
        } catch {}
        // Merge the resolved candidate into sessionState so the rest of the
        // app reads the RIGHT name/email, not the slot's primary candidate.
        setSessionState((prev: any) => prev ? {
          ...prev,
          candidate: {
            ...prev.candidate,
            id: result.candidateId,
            firstName: result.candidateFirstName,
            lastName: result.candidateLastName,
            email: result.candidateEmail,
          },
        } : prev)
      }

      const ok = await startCamera()
      if (ok) setPhase('camera')
    } catch (err: any) {
      setOtpAttempts(prev => prev + 1)
      const remaining = 3 - (otpAttempts + 1)
      if (remaining <= 0) {
        setPhase('terminated')
        toast.error('Too many failed attempts. Session locked.')
      } else {
        toast.error(`Invalid code. ${remaining} attempts remaining.`)
      }
    } finally { setLoading(false) }
  }

  const handleEnterWaiting = async () => {
    try {
      const { data } = await examApi.getSession(token)
      // Normalise: backend returns sessionId, ensure .id is always set
      setSessionState({ ...data, id: data.id || data.sessionId })
      // Check if multi-candidate session
      if (data.isMultiCandidate) {
        setPhase('verification')
      } else {
        setPhase('waiting')
      }
      // Poll for exam start
      const poll = setInterval(async () => {
        const { data: s } = await examApi.getSession(token)
        setSessionState(s)
        if (s.status === 'MCQ_IN_PROGRESS') {
          clearInterval(poll)
          await loadNextQuestion()
          setPhase('mcq')
        } else if (s.status === 'PRACTICAL_IN_PROGRESS') {
          clearInterval(poll)
          // Fetch practical task details separately if not included in session
          if (s.practicalTask) {
            setPracticalTask(s.practicalTask)
          } else {
            try {
              const { data: taskData } = await examApi.getPracticalTask(token)
              setPracticalTask(taskData)
            } catch {
              setPracticalTask({ title: 'Practical Task', description: 'Please follow the proctor\'s instructions.' })
            }
          }
          setPhase('practical')
        }
      }, 3000)
    } catch (err: any) {
      toast.error('Failed to load session')
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return
    setLoading(true)
    setUploadProgress(0)
    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post(`/exam/practical/submit?token=${token}`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
          setUploadProgress(percentCompleted)
        }
      })
      toast.success('File uploaded successfully')
      setPhase('complete')
    } catch (err: any) {
      toast.error('Upload failed. Please try again.')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  const loadNextQuestion = async () => {
    try {
      const { data } = await examApi.getCurrentQuestion(token)
      if (data.completed) { setPhase('mcq-complete'); return }
      setCurrentQuestion(data)
      setSelectedAnswer(null)
      setQuestionStartTime(Date.now())
    } catch (err: any) {
      if (err.response?.status === 400) setPhase('mcq-complete')
    }
  }

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) return
    setLoading(true)
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)
    try {
      const { data } = await examApi.submitAnswer(token, currentQuestion.questionId, selectedAnswer, timeSpent)
      if (data.isComplete) {
        setPhase('mcq-complete')
      } else {
        await loadNextQuestion()
      }
    } catch (err: any) {
      toast.error('Failed to submit answer')
    } finally { setLoading(false) }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const timerColor = timeRemaining < 300 ? 'var(--rose)' : timeRemaining < 600 ? 'var(--amber)' : 'var(--text-primary)'

  // â”€â”€ RENDER PHASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', background: 'var(--bg-base)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '20px',
  }
  const cardStyle: React.CSSProperties = { width: '100%', maxWidth: '480px' }

  if (phase === 'verifying-link') return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--cyan)', margin: '0 auto 20px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Verifying your assessment link...</p>
      </div>
    </div>
  )

  if (phase === 'link-expired') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <XCircle size={48} style={{ color: 'var(--rose)', margin: '0 auto 16px' }} />
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>Link No Longer Valid</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7' }}>
            Assessment links can only be used once and expire after the session has ended.
            If you believe this is an error, please contact your assessment coordinator.
          </p>
        </div>
      </div>
    </div>
  )

  if (phase === 'not-open') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <Clock size={48} style={{ color: 'var(--amber)', margin: '0 auto 16px' }} />
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>Session Not Open Yet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7' }}>
            Your assessment is scheduled for:<br />
            <strong>{sessionState ? new Date(sessionState.scheduledAt).toLocaleString() : 'Loading...'}</strong>
          </p>
          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(215,119,6,0.08)', borderRadius: '8px', fontSize: '13px', color: 'var(--amber)' }}>
            This page will refresh automatically when your session opens.
          </div>
        </div>
      </div>
    </div>
  )

  if (phase === 'otp-email') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--cyan)', fontSize: '24px', fontWeight: '700', margin: 0 }}>assessexpert</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Welcome to Your Assessment</p>
        </div>
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: 'var(--text-primary)' }}>Verify Your Identity</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>Confirm your email address to receive your verification code.</p>
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
              {loading ? 'Sending...' : 'Send Verification Code â†’'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  if (phase === 'otp-verify') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--cyan)', fontSize: '24px', fontWeight: '700', margin: 0 }}>assessexpert</h1>
        </div>
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: 'var(--text-primary)' }}>Enter Verification Code</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>A 6-digit code has been sent to <strong>{email}</strong></p>

          {/* Dev-only convenience: shows the actual generated OTP when the
              backend returns it (NEVER in production). No bypass code. */}
          {devOtp && (
            <div style={{ padding: '12px 16px', background: 'rgba(215,119,6,0.12)', border: '1px solid rgba(215,119,6,0.4)', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--amber)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dev Mode — OTP</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Generated code:</span>
                <button type="button" onClick={() => setOtpArray(devOtp.split(''))}
                  style={{ fontSize: '20px', fontWeight: '700', color: 'var(--amber)', letterSpacing: '6px', fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline dotted' }}>
                  {devOtp}
                </button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>Click to auto-fill · Dev only — hidden in production</p>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {otpArray.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpInputRefs.current[i] = el }}
                  className="form-input"
                  type="text"
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  maxLength={1}
                  style={{ width: '45px', height: '54px', textAlign: 'center', fontSize: '24px', fontWeight: '700', color: 'var(--cyan)' }}
                  required
                />
              ))}
            </div>
            {/* Terms & Conditions + Privacy Policy agreement.
                Candidate must tick this before they can verify the OTP. */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '12px 14px', background: 'var(--bg-elevated)',
              borderRadius: '8px', cursor: 'pointer',
              border: `1px solid ${legalAgreed ? 'rgba(5,150,105,0.4)' : 'var(--border)'}`,
            }}>
              <input
                type="checkbox"
                checked={legalAgreed}
                onChange={e => setLegalAgreed(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--emerald)', marginTop: '2px', flexShrink: 0 }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                I have read and agree to the{' '}
                <button type="button" onClick={() => setLegalView('terms')}
                  style={{ background: 'none', border: 'none', color: 'var(--cyan)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '12px' }}>
                  Terms & Conditions
                </button>
                {' '}and the{' '}
                <button type="button" onClick={() => setLegalView('privacy')}
                  style={{ background: 'none', border: 'none', color: 'var(--cyan)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '12px' }}>
                  Privacy Policy
                </button>
                .
              </span>
            </label>

            <button className="btn-primary" type="submit" disabled={loading || otpArray.some(d => !d) || !legalAgreed} style={{ width: '100%', padding: '12px', opacity: legalAgreed ? 1 : 0.5 }}>
              {loading ? 'Verifying...' : 'Verify & Continue â†’'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="btn-ghost"
                disabled={resendTimer > 0 || loading}
                onClick={handleResendOtp}
                style={{ fontSize: '13px' }}
              >
                {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Didn\'t receive it? Resend Code'}
              </button>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setPhase('otp-email')} style={{ width: '100%', color: 'var(--text-muted)' }}>← Back</button>

          {/* Legal content modal (Terms or Privacy) */}
          {legalView && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}>
              <div className="glass-card" style={{
                width: '100%', maxWidth: '720px', maxHeight: '88vh',
                display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
              }}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {legalView === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
                  </h2>
                  <button onClick={() => setLegalView(null)} type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px', padding: '4px 8px' }}>
                    ×
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
                  {legalContent && (legalView === 'terms' ? legalContent.termsAndConditions : legalContent.privacyPolicy) ? (
                    <div
                      style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{
                        __html: legalView === 'terms' ? legalContent.termsAndConditions : legalContent.privacyPolicy,
                      }}
                    />
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      This document has not been published yet. Please contact your assessment coordinator.
                    </p>
                  )}
                </div>
                <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
                  <button className="btn-ghost" onClick={() => setLegalView(null)} type="button" style={{ flex: 1 }}>Close</button>
                  <button className="btn-primary" onClick={() => { setLegalAgreed(true); setLegalView(null) }} type="button" style={{ flex: 2 }}>
                    I Have Read & Agree
                  </button>
                </div>
              </div>
            </div>
          )}
          </form>
        </div>
      </div>
    </div>
  )

  if (phase === 'camera') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: 'var(--text-primary)' }}>Camera & Device Check</h2>
          <video
            ref={el => { videoRef.current = el; assignStream(el) }}
            autoPlay muted playsInline
            style={{ width: '100%', borderRadius: '8px', background: '#000', marginBottom: '16px', aspectRatio: '16/9', objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {[
              { label: 'ðŸ“· Camera', status: 'âœ… Active' },
              { label: 'ðŸŽ™ï¸ Microphone', status: 'âœ… Active' },
              { label: 'ðŸŒ Internet', status: 'âœ… Connected' },
              { label: 'â›¶ Fullscreen', status: 'âœ… Supported' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ color: 'var(--emerald)' }}>{item.status}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={async () => { await enterFullscreen(); handleEnterWaiting() }} style={{ width: '100%', padding: '12px' }}>
            Enter Waiting Room â†’
          </button>
        </div>
      </div>
    </div>
  )

  if (phase === 'verification' || phase === 'waiting') return (
    <>
      <CandidateVerificationLayout
        sessionId={sessionState?.id || ''}
        candidateId={sessionState?.candidate?.id || ''}
        examTitle={sessionState?.assessmentType?.name || 'Assessment'}
        proctorStream={proctorStream as MediaStream | null}
        candidateStream={cameraStreamRef.current}
        checklist={checklist}
        proctorActive={proctorActive}
        screenShareRequested={screenShareRequested}
        onRequestScreenShare={requestScreenShare}
      />
      {guidelinesOpen && !guidelinesAgreed && (
        <GuidelinesModal
          examTitle={sessionState?.assessmentType?.name || 'Assessment'}
          candidateName={sessionState?.candidate ? `${sessionState.candidate.firstName} ${sessionState.candidate.lastName}` : undefined}
          onAgree={handleGuidelinesAgree}
          onDecline={handleGuidelinesDecline}
        />
      )}
    </>
  )
  if (phase === 'mcq' && currentQuestion) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* AI Warning Banner */}
      {aiWarning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: aiWarning.type === 'critical' ? 'var(--rose)' : 'var(--amber)', color: '#fff', padding: '10px', textAlign: 'center', zIndex: 1000, fontWeight: '600', animation: 'slideDown 0.3s ease-out' }}>
          {aiWarning.message}
        </div>
      )}

      {/* 1 Minute Warning Overlay */}
      {timeRemaining === 60 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(225,29,72,0.2)', pointerEvents: 'none', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--rose)', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', fontSize: '18px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
            â± 1 minute remaining â€” please submit your current answer.
          </div>
        </div>
      )}

      {/* Offline Overlay */}
      {!isOnline && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--rose)', marginBottom: '20px' }} />
          <h2 style={{ color: '#fff', marginBottom: '8px' }}>Connection Lost</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Attempting to reconnect... your progress is saved.</p>
        </div>
      )}

      {/* Fullscreen Guard */}
      {!isFullscreen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Monitor size={64} style={{ color: 'var(--rose)', marginBottom: '20px' }} />
          <h2 style={{ color: '#fff', marginBottom: '12px' }}>Full Screen Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Please return to full screen mode to continue the assessment.</p>
          <button className="btn-primary" onClick={enterFullscreen} style={{ padding: '12px 32px' }}>Return to Full Screen â†’</button>
        </div>
      )}
      {/* MCQ: proctor feed + self preview */}
      <div style={{ position: 'fixed', left: '16px', bottom: '16px', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ position: 'relative', width: '150px', aspectRatio: '16/9', background: '#000', borderRadius: '7px', border: `2px solid ${proctorStream ? 'var(--cyan)' : 'var(--border)'}`, overflow: 'hidden' }}>
          {proctorStream ? (
            <video autoPlay playsInline
              ref={el => { if (el && proctorStream && el.srcObject !== proctorStream) { el.srcObject = proctorStream; el.play().catch(() => {}) } }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Proctor</span>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '2px', left: '4px', background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: '3px', fontSize: '8px', color: proctorStream ? 'var(--cyan)' : 'var(--text-muted)' }}>PROCTOR</div>
        </div>
        <div style={{ position: 'relative', width: '150px', aspectRatio: '16/9', background: '#000', borderRadius: '7px', border: '2px solid var(--emerald)', overflow: 'hidden' }}>
          <video autoPlay muted playsInline
            ref={el => { if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) { el.srcObject = cameraStreamRef.current; el.play().catch(() => {}) } }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', bottom: '2px', left: '4px', background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: '3px', fontSize: '8px', color: 'var(--emerald)' }}>YOU</div>
        </div>
      </div>
      {/* Top bar */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          assessexpert &nbsp;|&nbsp; {sessionState?.assessmentType} â€” MCQ Assessment
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ðŸ“· <span style={{ color: 'var(--emerald)' }}>â—</span> REC</span>
          <span style={{ fontSize: '20px', fontWeight: '700', color: timerColor, fontFamily: 'var(--font-mono)' }}>â± {formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Question */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '720px' }}>
          <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Question {currentQuestion.position} of {currentQuestion.totalQuestions}
          </div>
          <div style={{ height: '3px', background: 'var(--bg-elevated)', borderRadius: '2px', marginBottom: '28px' }}>
            <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${(currentQuestion.position / currentQuestion.totalQuestions) * 100}%`, transition: 'width 0.3s' }} />
          </div>

          <div className="glass-card" style={{ padding: '28px', marginBottom: '20px' }}>
            <p style={{ fontSize: '17px', color: 'var(--text-primary)', lineHeight: '1.7', margin: 0 }}>
              {(currentQuestion.content as any)?.text}
            </p>
            {(currentQuestion.content as any)?.imageUrl && (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={uploadUrl((currentQuestion.content as any).imageUrl)}
                  alt="Question diagram"
                  style={{ maxWidth: '100%', maxHeight: '380px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {((currentQuestion.options as any[]) || []).map((opt: any) => (
              <button key={opt.key} onClick={() => setSelectedAnswer(opt.key)} style={{
                width: '100%', padding: '16px 20px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                background: selectedAnswer === opt.key ? 'rgba(0,212,255,0.12)' : 'var(--bg-surface)',
                border: `1px solid ${selectedAnswer === opt.key ? 'var(--cyan)' : 'var(--border)'}`,
                color: selectedAnswer === opt.key ? 'var(--cyan)' : 'var(--text-secondary)',
                fontSize: '15px', transition: 'all 0.15s',
              }}>
                <span style={{ fontWeight: '600', marginRight: '12px' }}>{opt.key}.</span>{opt.text}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={handleSubmitAnswer} disabled={!selectedAnswer || loading} style={{ padding: '12px 32px', fontSize: '15px', opacity: selectedAnswer ? 1 : 0.5 }}>
              {loading ? 'Submitting...' : 'Submit Answer â†’'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (phase === 'mcq-complete') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>âœ…</div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>MCQ Assessment Complete</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7' }}>
            You have answered all questions. Your proctor will now assign your practical task. Please remain on camera and wait for instructions.
          </p>
          <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(0,212,255,0.08)', borderRadius: '8px', fontSize: '13px', color: 'var(--cyan)' }}>
            â³ Waiting for proctor to begin the practical phase...
          </div>
        </div>
      </div>
    </div>
  )

  if (phase === 'practical' && (sessionState?.practicalPaperSetId || sessionState?.practicalPaperSet)) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>assessexpert &nbsp;|&nbsp; {sessionState?.assessmentType?.name} — Practical Assessment</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>📷 <span style={{ color: 'var(--emerald)' }}>●</span> REC</span>
          <span style={{ fontSize: '20px', fontWeight: '700', color: timerColor, fontFamily: 'var(--font-mono)' }}>⏱ {formatTime(timeRemaining)}</span>
        </div>
      </div>
      <PracticalSetView
        token={token}
        sessionId={sessionState.id}
        socket={wsSocket}
        onAllSubmitted={() => {
          toast.success('All practical answers submitted')
          setPhase('complete')
        }}
      />
    </div>
  )

  if (phase === 'practical') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>assessexpert &nbsp;|&nbsp; {sessionState?.assessmentType?.name} â€” Practical Assessment</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ðŸ“· <span style={{ color: 'var(--emerald)' }}>â—</span> REC</span>
          <span style={{ fontSize: '20px', fontWeight: '700', color: timerColor, fontFamily: 'var(--font-mono)' }}>â± {formatTime(timeRemaining)}</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '720px' }}>
          <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', marginBottom: '16px' }}>{practicalTask?.title || 'Practical Task'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.7', marginBottom: '24px' }}>
              {practicalTask?.description || "Please follow the proctor's instructions to complete the task."}
            </p>
            {practicalTask?.sourceFileUrl && (
              <a href={practicalTask.sourceFileUrl} download className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                â¬‡ Download Starter File
              </a>
            )}
          </div>
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--border)', cursor: 'pointer' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
            onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileUpload(f) }; i.click() }}
          >
            {loading ? (
              <div style={{ width: '100%' }}>
                <p style={{ color: 'var(--cyan)', marginBottom: '10px' }}>Uploading... {uploadProgress}%</p>
                <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--cyan)', transition: 'width 0.2s' }} />
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>Drag and drop your file here</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or click to browse from your computer</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (phase === 'complete') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>ðŸŽ‰</div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>Assessment Complete</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7' }}>Thank you. Your assessment has been completed and submitted.</p>
          <div style={{ marginTop: '20px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'left' }}>
            <p style={{ margin: '0 0 4px' }}>1. Your assessment is being reviewed by your proctor.</p>
            <p style={{ margin: '0 0 4px' }}>2. A report will be shared with the hiring team.</p>
            <p style={{ margin: 0 }}>3. The hiring team will be in touch with you directly.</p>
          </div>
          <button className="btn-ghost" onClick={() => window.close()} style={{ marginTop: '20px', width: '100%' }}>Close Window</button>
        </div>
      </div>
    </div>
  )

  if (phase === 'terminated') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center', borderLeft: '3px solid var(--rose)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>â›”</div>
          <h2 style={{ color: 'var(--rose)', margin: '0 0 12px' }}>Session Terminated</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            The proctor has ended this assessment session. Please contact your assessment coordinator for further information.
          </p>
        </div>
      </div>
    </div>
  )

  return <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>Loading...</div>
}

export default function ExamPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading session...</div>}>
      <ExamContent />
    </Suspense>
  )
}
