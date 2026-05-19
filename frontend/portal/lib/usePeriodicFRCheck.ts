'use client'
import { useEffect, useRef } from 'react'
import { api } from './api'

interface UsePeriodicFRCheckOptions {
  enabled: boolean
  stream: MediaStream | null
  sessionId: string
  token: string
  candidateId?: string
  // Seconds between captures. The server logs every result so don't crank
  // this down without thinking about FR-image disk usage. Default: 2 min.
  intervalSec?: number
  // JPEG quality 0..1. Lower = smaller upload, but too low and MediaPipe
  // struggles to extract landmarks. 0.7 is the empirical sweet spot.
  jpegQuality?: number
}

/**
 * Captures a single webcam frame at a slow cadence (default 2 minutes)
 * during the active exam and POSTs it to the magic-token-authed FR
 * endpoint. The server compares against the candidate's persisted
 * reference embedding and emits a socket event to the proctor if the
 * outcome is anything other than VERIFIED.
 *
 * Why a separate hook instead of bolting onto useFaceDetection?
 * - useFaceDetection runs every 1s in the browser only (no upload).
 *   This hook does the opposite: rare uploads, real identity check.
 * - The "is this the same person" comparison HAS to happen server-side
 *   against the persisted reference photo. The client can't do that.
 * - Decoupling means we can switch the cadence or kill-switch this
 *   feature without touching the in-frame face detection logic.
 */
export function usePeriodicFRCheck({
  enabled,
  stream,
  sessionId,
  token,
  candidateId,
  intervalSec = 120,
  jpegQuality = 0.7,
}: UsePeriodicFRCheckOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!enabled || !stream || !sessionId || !token) return
    let cancelled = false

    const setup = async () => {
      // Detached video element so we can grab a frame without affecting
      // any UI-bound video the page might be rendering.
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      try { await video.play() } catch {}
      videoRef.current = video

      const canvas = document.createElement('canvas')
      canvasRef.current = canvas

      const capture = async () => {
        if (cancelled || inFlightRef.current) return
        const v = videoRef.current
        const c = canvasRef.current
        if (!v || !c) return
        if (v.videoWidth === 0 || v.videoHeight === 0) return
        inFlightRef.current = true
        try {
          c.width = v.videoWidth
          c.height = v.videoHeight
          const ctx = c.getContext('2d')
          if (!ctx) return
          ctx.drawImage(v, 0, 0, c.width, c.height)
          const dataUrl = c.toDataURL('image/jpeg', jpegQuality)
          await api.post(
            `/facial-recognition/sessions/${sessionId}/candidate-periodic`,
            { capturedImage: dataUrl, candidateId },
            { params: { token, ...(candidateId ? { candidateId } : {}) } },
          )
        } catch {
          // Swallow errors — FR checks are best-effort. Network blips
          // shouldn't kill the exam. The proctor sees the missed-check
          // gap in the FR log timestamps anyway.
        } finally {
          inFlightRef.current = false
        }
      }

      // Fire one immediately, then on the configured interval. The first
      // capture gives the proctor an early-warning before the candidate
      // has answered many questions.
      capture()
      intervalRef.current = setInterval(capture, intervalSec * 1000)
    }

    setup()

    return () => {
      cancelled = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      try {
        videoRef.current?.pause()
        videoRef.current = null
      } catch {}
      canvasRef.current = null
    }
  }, [enabled, stream, sessionId, token, candidateId, intervalSec, jpegQuality])
}
