'use client'
import { useEffect, useRef } from 'react'

interface UseFaceDetectionOptions {
  enabled: boolean
  stream: MediaStream | null
  socket: any
  sessionId: string
  candidateId?: string
  intervalMs?: number
  // How many consecutive ticks without a face before raising face_absent
  absentThreshold?: number
  // How many consecutive ticks with multiple faces before raising multiple_faces
  multipleThreshold?: number
}

/**
 * Runs MediaPipe Tasks Vision face detection in the candidate's browser.
 * Emits ai.* socket events to the backend so the proctor sees warnings in real time.
 *
 * Why client-side instead of server-side?
 * - No video upload bandwidth
 * - No GPU on the server needed
 * - Backend MediaPipe was failing with "document is not defined" anyway
 *
 * Detection cadence: every 1 second (configurable). Debounced — a single
 * frame with no face doesn't trigger an alert; we wait for ~3 consecutive
 * misses to avoid false positives during normal head movement.
 */
export function useFaceDetection({
  enabled,
  stream,
  socket,
  sessionId,
  candidateId,
  intervalMs = 1000,
  // Raised to 5s of no face / 4s of multiple faces before alerting. The
  // previous 3s/2s defaults fired on routine blur, head turns, and a
  // partner walking past in the background — clarity issues, not real
  // integrity events. The proctor still sees the alert if the condition
  // persists, just not on transient frames.
  absentThreshold = 5,
  multipleThreshold = 4,
}: UseFaceDetectionOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const detectorRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const absentCountRef = useRef(0)
  const multipleCountRef = useRef(0)
  const lastAlertRef = useRef<{ type: string; t: number }>({ type: '', t: 0 })

  useEffect(() => {
    if (!enabled || !stream) return

    let cancelled = false

    const init = async () => {
      try {
        // Hidden video element to feed frames into MediaPipe
        const video = document.createElement('video')
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        await video.play().catch(() => {})
        videoRef.current = video

        // Dynamic-import MediaPipe so SSR doesn't break
        const vision = await import('@mediapipe/tasks-vision')
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
        )
        const detector = await vision.FaceDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          // Lowered from 0.5 → 0.4 so blurry / poorly-lit frames still
          // register as a detected face. With 0.5, even a clear face went
          // undetected when the candidate's webcam compressed hard, and
          // the proctor saw a "face absent" alert every minute.
          minDetectionConfidence: 0.4,
        })
        if (cancelled) {
          detector.close()
          return
        }
        detectorRef.current = detector

        intervalRef.current = setInterval(() => {
          if (!videoRef.current || !detectorRef.current) return
          if (videoRef.current.readyState < 2) return
          try {
            const result = detectorRef.current.detectForVideo(videoRef.current, performance.now())
            const count = result?.detections?.length || 0
            handleDetection(count)
          } catch {
            // Detection failure — ignore, will retry next interval
          }
        }, intervalMs)
      } catch (e) {
        console.warn('[FaceDetection] init failed:', e)
      }
    }

    const emitAlert = (type: 'multiple_faces' | 'face_absent', data: any) => {
      const now = Date.now()
      // Throttle: don't fire the same alert type more than once every 15 seconds
      if (lastAlertRef.current.type === type && now - lastAlertRef.current.t < 15_000) return
      lastAlertRef.current = { type, t: now }
      if (!socket?.connected) return
      socket.emit(`ai.${type}`, { sessionId, candidateId, ...data, timestamp: new Date().toISOString() })
    }

    const handleDetection = (faceCount: number) => {
      if (faceCount === 0) {
        absentCountRef.current++
        multipleCountRef.current = 0
        if (absentCountRef.current >= absentThreshold) {
          emitAlert('face_absent', { message: 'Face not detected on camera' })
        }
      } else if (faceCount > 1) {
        multipleCountRef.current++
        absentCountRef.current = 0
        if (multipleCountRef.current >= multipleThreshold) {
          emitAlert('multiple_faces', {
            faceCount,
            message: `${faceCount} faces detected — only the candidate should be visible`,
          })
        }
      } else {
        // Exactly 1 face — reset counters
        absentCountRef.current = 0
        multipleCountRef.current = 0
      }
    }

    init()

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (detectorRef.current) {
        try { detectorRef.current.close() } catch {}
        detectorRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
        videoRef.current = null
      }
    }
  }, [enabled, stream, socket, sessionId, candidateId, intervalMs, absentThreshold, multipleThreshold])
}
