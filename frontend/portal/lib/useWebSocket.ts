'use client'
import { useEffect, useRef, useCallback } from 'react'

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
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !sessionId || typeof window === 'undefined') return

    let socket: any

    const connect = async () => {
      const ioFn = await getIo()
      socket = ioFn(WS_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      })

      socketRef.current = socket

      socket.on('connect', () => {
        socket.emit('join_session', { sessionId, role, userId })
      })

      socket.on('disconnect', () => {
        onEventRef.current?.('disconnect', {})
      })

      socket.on('connect_error', () => {
        onEventRef.current?.('connect_error', {})
      })

      // Forward all session events to the onEvent handler
      const SESSION_EVENTS = [
        'candidate.joined',
        'candidate.status',
        'checklist.update',
        'proctor.message',
        'ai.flag',
        'session.pause',
        'session.phase',
        'report.ready',
        'session.submitted',
      ]

      SESSION_EVENTS.forEach(ev => {
        socket.on(ev, (data: any) => {
          onEventRef.current?.(ev, data)
        })
      })
    }

    connect()

    return () => {
      if (socket) {
        socket.emit('leave_session', { sessionId })
        socket.disconnect()
      }
      socketRef.current = null
    }
  }, [sessionId, role, userId, enabled])

  return { emit, socket: socketRef.current }
}
