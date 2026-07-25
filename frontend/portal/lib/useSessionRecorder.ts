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
 *
 * ---
 * Ordering guarantee (SAST P2 #9 fix):
 *
 *   When MediaRecorder.stop() is called, the browser emits ONE final
 *   `dataavailable` event with the last <chunkSeconds seconds of
 *   buffered video, followed by `onstop`. The previous implementation
 *   set a `stopped` flag on cleanup and short-circuited every incoming
 *   chunk, which silently dropped that final segment — recordings were
 *   missing their last ~5 seconds. Worse, finalize was fired
 *   immediately after `stop()` without waiting for in-flight uploads,
 *   so even chunks accepted by the browser could arrive at the server
 *   AFTER the merge, ending up as orphaned files.
 *
 *   The fix: accept the final chunk normally, track every upload
 *   Promise, and only fire finalize once (a) both recorders have
 *   emitted `onstop` and (b) every pending upload has settled.
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

type StreamType = 'webcam' | 'screen'

export function useSessionRecorder({
  enabled,
  sessionId,
  token,
  candidateId,
  webcamStream,
  screenStream,
  chunkSeconds = 5,
}: Options) {
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

    // Track every in-flight upload so finalize can wait for them.
    const pendingUploads = new Set<Promise<unknown>>()
    // "Has this recorder finished stopping?" — starts false and stays
    // that way until the cleanup phase, so maybeFinalize called during
    // recorder setup (from a fast onstop) can't misfire early.
    const stoppedFlags: Record<StreamType, boolean> = { webcam: false, screen: false }
    // Guard so we don't try to close streams / finalize before the
    // user actually navigates away — set true in the cleanup callback.
    let cleaningUp = false
    let finalizedOnce = false

    const uploadChunk = async (blob: Blob, streamType: StreamType, idx: number) => {
      const fd = new FormData()
      fd.append('chunk', blob, `${streamType}-${idx}.webm`)
      fd.append('streamType', streamType)
      fd.append('chunkIndex', String(idx))
      if (candidateId) fd.append('candidateId', candidateId)
      const cidQs = candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ''
      try {
        await fetch(
          `${API_URL}/recordings/sessions/${encodeURIComponent(sessionId)}/chunk?token=${encodeURIComponent(token)}${cidQs}`,
          {
            method: 'POST',
            body: fd,
            // keepalive lets the final upload complete even if the tab
            // is closing. Chrome caps keepalive bodies at 64 KB, so
            // this is best-effort for the last chunk — larger buffers
            // will fall back to a normal request that the browser may
            // abort on unload.
            keepalive: true,
          },
        )
      } catch {
        // Network blip — the chunk is dropped. Better than crashing
        // the recorder for one missed segment.
      }
    }

    const maybeFinalize = () => {
      if (finalizedOnce) return
      // Only ever fire during the cleanup phase — protects against a
      // recorder that emits onstop before setup finishes (e.g. a
      // stream that goes inactive during startup).
      if (!cleaningUp) return
      if (!stoppedFlags.webcam || !stoppedFlags.screen) return
      finalizedOnce = true
      const cidQs = candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ''
      const finalizeUrl = `${API_URL}/recordings/sessions/${encodeURIComponent(sessionId)}/finalize?token=${encodeURIComponent(token)}${cidQs}`
      // Wait for every in-flight chunk upload to settle before telling
      // the server to merge — otherwise finalize can run against an
      // incomplete chunk set.
      Promise.allSettled(Array.from(pendingUploads))
        .then(() =>
          fetch(finalizeUrl, { method: 'POST', keepalive: true }).catch(() => {}),
        )
        .catch(() => {})
    }

    const startRecorder = (stream: MediaStream | null | undefined, streamType: StreamType) => {
      if (!stream || !stream.active) return null
      try {
        const rec = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 500_000,
          audioBitsPerSecond: 64_000,
        })
        rec.ondataavailable = (e: BlobEvent) => {
          if (!e.data || e.data.size === 0) return
          const idx = chunkIdxRef.current[streamType]++
          const p = uploadChunk(e.data, streamType, idx)
          pendingUploads.add(p)
          p.finally(() => pendingUploads.delete(p))
        }
        rec.onerror = (ev: any) => {
          // eslint-disable-next-line no-console
          console.warn(`[recorder] ${streamType} recorder error:`, ev?.error || ev)
        }
        rec.onstop = () => {
          stoppedFlags[streamType] = true
          maybeFinalize()
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
      cleaningUp = true
      const { webcam, screen } = recordersRef.current
      // If a recorder was never created (no stream or failed to start),
      // flip its stopped flag directly — nothing will emit onstop.
      if (!webcam) stoppedFlags.webcam = true
      if (!screen) stoppedFlags.screen = true
      // Requesting stop triggers one final `dataavailable` and then
      // `onstop`. The onstop handlers flip the stopped flags and call
      // maybeFinalize, which waits for in-flight uploads before firing
      // the server-side merge.
      try {
        if (webcam && webcam.state !== 'inactive') webcam.stop()
        else if (webcam) stoppedFlags.webcam = true
      } catch {
        stoppedFlags.webcam = true
      }
      try {
        if (screen && screen.state !== 'inactive') screen.stop()
        else if (screen) stoppedFlags.screen = true
      } catch {
        stoppedFlags.screen = true
      }
      recordersRef.current = { webcam: null, screen: null }
      // Covers the case where nothing needs an onstop (both recorders
      // already inactive or never started).
      maybeFinalize()
    }
  }, [enabled, sessionId, token, candidateId, webcamStream, screenStream, chunkSeconds])
}
