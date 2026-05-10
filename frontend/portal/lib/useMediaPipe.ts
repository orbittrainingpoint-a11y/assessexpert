'use client'
import { useEffect, useState, useCallback, useRef } from 'react'

export interface AIAlert {
  id: string
  type: 'multiple_faces' | 'face_absent' | 'looking_away' | 'hand_near_face' | 'gaze_offscreen'
  severity: 'warning' | 'critical'
  message: string
  timestamp: Date
  metadata?: any
}

export interface BehaviorScore {
  score: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  violations: {
    multipleFaces: number
    faceAbsent: number
    lookingAway: number
    handNearFace: number
    gazeOffscreen: number
  }
}

interface UseMediaPipeOptions {
  sessionId: string
  socket: any
  enabled?: boolean
  onAlert?: (alert: AIAlert) => void
}

export function useMediaPipe({ sessionId, socket, enabled = true, onAlert }: UseMediaPipeOptions) {
  const [alerts, setAlerts] = useState<AIAlert[]>([])
  const [behaviorScore, setBehaviorScore] = useState<BehaviorScore | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const alertTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const addAlert = useCallback((alert: AIAlert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 50)) // Keep last 50 alerts
    onAlert?.(alert)

    // Auto-dismiss warning alerts after 15 seconds
    if (alert.severity === 'warning') {
      const timeout = setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alert.id))
      }, 15000)
      alertTimeoutRef.current.set(alert.id, timeout)
    }
  }, [onAlert])

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    const timeout = alertTimeoutRef.current.get(alertId)
    if (timeout) {
      clearTimeout(timeout)
      alertTimeoutRef.current.delete(alertId)
    }
  }, [])

  const clearAlerts = useCallback(() => {
    alertTimeoutRef.current.forEach(timeout => clearTimeout(timeout))
    alertTimeoutRef.current.clear()
    setAlerts([])
  }, [])

  useEffect(() => {
    if (!enabled || !socket || !sessionId) return

    const handleMultipleFaces = (data: any) => {
      const alert: AIAlert = {
        id: `mf-${Date.now()}`,
        type: 'multiple_faces',
        severity: 'critical',
        message: `⚠️ Multiple faces detected (${data.faceCount} faces)`,
        timestamp: new Date(),
        metadata: data,
      }
      addAlert(alert)
    }

    const handleFaceAbsent = (data: any) => {
      const alert: AIAlert = {
        id: `fa-${Date.now()}`,
        type: 'face_absent',
        severity: 'critical',
        message: '⚠️ Face not detected - please remain visible',
        timestamp: new Date(),
        metadata: data,
      }
      addAlert(alert)
    }

    const handleLookingAway = (data: any) => {
      const alert: AIAlert = {
        id: `la-${Date.now()}`,
        type: 'looking_away',
        severity: 'warning',
        message: '👀 Looking away from screen detected',
        timestamp: new Date(),
        metadata: data,
      }
      addAlert(alert)
    }

    const handleHandNearFace = (data: any) => {
      const alert: AIAlert = {
        id: `hn-${Date.now()}`,
        type: 'hand_near_face',
        severity: 'warning',
        message: '✋ Hand near face detected',
        timestamp: new Date(),
        metadata: data,
      }
      addAlert(alert)
    }

    const handleGazeOffscreen = (data: any) => {
      const alert: AIAlert = {
        id: `go-${Date.now()}`,
        type: 'gaze_offscreen',
        severity: 'warning',
        message: '👁️ Gaze directed away from screen',
        timestamp: new Date(),
        metadata: data,
      }
      addAlert(alert)
    }

    const handleBehaviorScore = (data: BehaviorScore) => {
      setBehaviorScore(data)
    }

    const handleMonitoringStart = () => {
      setIsMonitoring(true)
    }

    const handleMonitoringStop = () => {
      setIsMonitoring(false)
    }

    socket.on('ai.multiple_faces', handleMultipleFaces)
    socket.on('ai.face_absent', handleFaceAbsent)
    socket.on('ai.looking_away', handleLookingAway)
    socket.on('ai.hand_near_face', handleHandNearFace)
    socket.on('ai.gaze_offscreen', handleGazeOffscreen)
    socket.on('ai.behavior_score', handleBehaviorScore)
    socket.on('ai.monitoring_start', handleMonitoringStart)
    socket.on('ai.monitoring_stop', handleMonitoringStop)

    return () => {
      socket.off('ai.multiple_faces', handleMultipleFaces)
      socket.off('ai.face_absent', handleFaceAbsent)
      socket.off('ai.looking_away', handleLookingAway)
      socket.off('ai.hand_near_face', handleHandNearFace)
      socket.off('ai.gaze_offscreen', handleGazeOffscreen)
      socket.off('ai.behavior_score', handleBehaviorScore)
      socket.off('ai.monitoring_start', handleMonitoringStart)
      socket.off('ai.monitoring_stop', handleMonitoringStop)
      clearAlerts()
    }
  }, [enabled, socket, sessionId, addAlert, clearAlerts])

  return {
    alerts,
    behaviorScore,
    isMonitoring,
    dismissAlert,
    clearAlerts,
  }
}
