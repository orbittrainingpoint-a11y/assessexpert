'use client'
import { useEffect, useRef } from 'react'

/**
 * Record the candidate's webcam + screen share continuously during the
 * exam and upload chunks to the backend.
 *
 * Two parallel MediaRecorder instances are used (one per stream) so they
 * can be enabled/disabled independently. Chunks are uploaded as they're
 * produced (`timeslice` ms). On unmount or when `enabled` flips false
 * the recorders are stopped and the backend is told to finalize so the
 * chunks get merged into the final webcam.webm / screen.webm files.
 *
 * Bitrate is intentionally low (~500 kbps video) to keep storage in
 * check — at 90 minutes per session this is ~330 MB.
 */

interface Options {
  enabled: boolean
  sessionId?: string
  token?: string
  /** Required for multi-candidate slots so chunks land in the right
   *  per-candidate directory. Single-candidate sessions can omit and
   *  the backend falls back to the session's primary candidate. */
  candidateId?: string
  webcamStream?: MediaStream | null
  screenStream?: MediaStream | null
  chunkSeconds?: number
}

const API_URL = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') || 'http://localhost:4000/api'

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ]
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function useSessionRecorder({
  enabled,
  sessionId,
  token,
  candidateId,
  webcamStream,
  screenStream,
  chunkSeconds = 5,
}: Options) {
  // Recorders + chunk counters survive re-renders so re-running the effect
  // doesn't reset to chunk 0 (which would overwrite earlier files on disk).
  const recordersRef = useRef<{ webcam: MediaRecorder | null; screen: MediaRecorder | null }>({
    webcam: null,
    screen: null,
  })
  const chunkIdxRef = useRef<{ webcam: number; screen: number }>({ webcam: 0, screen: 0 })

  useEffect(() => {
    if (!enabled || !sessionId || !token) return
    if (typeof MediaRecorder === 'undefined') return

    const mimeType = pickMimeType()
    if (!mimeType) {
      // eslint-disable-next-line no-console
      console.warn('[recorder] No supported WebM codec — recording disabled in this browser.')
      return
    }

    let stopped = false

    const startRecorder = (stream: MediaStream | null | undefined, streamType: 'webcam' | 'screen') => {
      if (!stream || !stream.active) return null
      try {
        const rec = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 500_000,
          audioBitsPerSecond: 64_000,
        })
        rec.ondataavailable = async (e: BlobEvent) => {
          if (stopped || !e.data || e.data.size === 0) return
          const idx = chunkIdxRef.current[streamType]++
          const fd = new FormData()
          fd.append('chunk', e.data, `${streamType}-${idx}.webm`)
          fd.append('streamType', streamType)
          fd.append('chunkIndex', String(idx))
          if (candidateId) fd.append('candidateId', candidateId)
          const cidQs = candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ''
          try {
            await fetch(
              `${API_URL}/recordings/sessions/${encodeURIComponent(sessionId)}/chunk?token=${encodeURIComponent(token)}${cidQs}`,
              { method: 'POST', body: fd },
            )
          } catch {
            // Network blip — keep recording, the chunk is dropped. Better
            // than crashing the recorder for one missed segment.
          }
        }
        rec.onerror = (ev: any) => {
          // eslint-disable-next-line no-console
          console.warn(`[recorder] ${streamType} recorder error:`, ev?.error || ev)
        }
        rec.start(chunkSeconds * 1000)
        return rec
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[recorder] Failed to start ${streamType} recorder:`, e)
        return null
      }
    }

    recordersRef.current.webcam = startRecorder(webcamStream, 'webcam')
    recordersRef.current.screen = startRecorder(screenStream, 'screen')

    return () => {
      stopped = true
      const { webcam, screen } = recordersRef.current
      try { if (webcam && webcam.state !== 'inactive') webcam.stop() } catch {}
      try { if (screen && screen.state !== 'inactive') screen.stop() } catch {}
      recordersRef.current = { webcam: null, screen: null }
      // Best-effort finalize. If this fails (e.g. user closed tab abruptly)
      // the chunks remain on disk and finalize can be triggered server-side
      // by the daily cron or manually by an admin.
      const cidQs = candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ''
      fetch(
        `${API_URL}/recordings/sessions/${encodeURIComponent(sessionId)}/finalize?token=${encodeURIComponent(token)}${cidQs}`,
        { method: 'POST', keepalive: true },
      ).catch(() => {})
    }
  }, [enabled, sessionId, token, candidateId, webcamStream, screenStream, chunkSeconds])
}
