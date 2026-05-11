'use client'
import { useEffect, useRef, useCallback, useState } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000'

// Lazy-load socket.io-client to avoid SSR issues
let io: any = null
const getIo = async () => {
  if (!io) {
    const mod = await import('socket.io-client')
    io = mod.io
  }
  return io
}

interface UseWebSocketOptions {
  sessionId: string
  role: 'PROCTOR' | 'CANDIDATE' | 'MASTER_PROCTOR' | 'OBSERVER'
  userId?: string
  enabled?: boolean
  onEvent?: (event: string, data: any) => void
}

export function useSessionWebSocket({
  sessionId,
  role,
  userId,
  enabled = true,
  onEvent,
}: UseWebSocketOptions) {
  const socketRef = useRef<any>(null)
  const [socket, setSocket] = useState<any>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !sessionId || typeof window === 'undefined') return

    let socketLocal: any

    const connect = async () => {
      const ioFn = await getIo()
      socketLocal = ioFn(WS_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      })

      socketRef.current = socketLocal
      setSocket(socketLocal) // Reactive — consumers re-render when socket is ready

      socketLocal.on('connect', () => {
        socketLocal.emit('join_session', { sessionId, role, userId })
      })

      socketLocal.on('disconnect', () => {
        onEventRef.current?.('disconnect', {})
      })

      socketLocal.on('connect_error', () => {
        onEventRef.current?.('connect_error', {})
      })

      // Forward all session events to the onEvent handler
      const SESSION_EVENTS = [
        'candidate.joined',
        'candidate.status',
        'candidate.disqualified',
        'candidate.screenShareActive',
        'candidate.screenShareStopped',
        'practical.setAssigned',
        'practical.answerSubmitted',
        'checklist.update',
        'checklist.itemUpdated',
        'checklist.candidateComplete',
        'proctor.message',
        'proctor.enterVerification',
        'proctor.leaveVerification',
        'proctor.allVerified',
        'ai.flag',
        'ai.multiple_faces',
        'ai.face_absent',
        'ai.looking_away',
        'ai.hand_near_face',
        'ai.gaze_offscreen',
        'ai.behavior_score',
        'session.pause',
        'session.phase',
        'exam.pushMCQ',
        'exam.pushPractical',
        'exam.mcqSubmitted',
        'exam.allMCQDone',
        'report.ready',
        'session.submitted',
        'webrtc.offer',
        'webrtc.answer',
        'webrtc.ice',
        'peer.joined',
        'peer.left',
        'proctor.audio_active',
        'proctor.audio_inactive',
      ]

      SESSION_EVENTS.forEach(ev => {
        socketLocal.on(ev, (data: any) => {
          onEventRef.current?.(ev, data)
        })
      })
    }

    connect()

    return () => {
      if (socketLocal) {
        socketLocal.emit('leave_session', { sessionId })
        socketLocal.disconnect()
      }
      socketRef.current = null
      setSocket(null)
    }
  }, [sessionId, role, userId, enabled])

  return { emit, socket }
}
