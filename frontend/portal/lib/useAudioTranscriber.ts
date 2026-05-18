'use client'
import { useEffect, useRef } from 'react'

/**
 * Capture audio in short chunks and POST each chunk to an AI transcription
 * endpoint. Replaces (or augments) browser SpeechRecognition for the
 * persistent verification-conversation transcript on the report.
 *
 * The hook reuses an existing MediaStream's audio track instead of asking
 * for the mic separately — pass the same stream that's already serving
 * WebRTC so the user only sees one mic permission prompt.
 *
 * On unmount the recorder is stopped; any in-flight chunk POST is left
 * to finish (keepalive). Chunks that fail to upload are silently dropped
 * — the user gets a near-real-time transcript, not an audit log.
 */

interface Options {
  enabled: boolean
  /** Existing MediaStream containing the mic audio track. Pass the same
   *  stream you gave to WebRTC so we don't acquire the mic twice. */
  micStream: MediaStream | null | undefined
  /** Full URL to POST chunks to. Hook attaches a multipart `audio` part
   *  + the `body` map you provide. Construct the endpoint per role
   *  (candidate vs proctor) — the hook is dumb about auth. */
  endpoint: string
  /** Extra form fields per upload (candidateId, timestamp, etc.) */
  extraFields?: () => Record<string, string | undefined>
  /** Optional request headers (e.g. JWT Authorization for the proctor). */
  headers?: () => Record<string, string>
  chunkSeconds?: number
}

function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
  ]
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function useAudioTranscriber({
  enabled,
  micStream,
  endpoint,
  extraFields,
  headers,
  chunkSeconds = 8,
}: Options) {
  const recRef = useRef<MediaRecorder | null>(null)
  const audioOnlyRef = useRef<MediaStream | null>(null)
  // Re-evaluate the extraFields/headers snapshot on each chunk so changes
  // (e.g. active candidateId, refreshed JWT) propagate without restarting.
  const extraFieldsRef = useRef(extraFields)
  extraFieldsRef.current = extraFields
  const headersRef = useRef(headers)
  headersRef.current = headers

  useEffect(() => {
    if (!enabled) return
    if (typeof MediaRecorder === 'undefined') return
    if (!micStream) return
    const tracks = micStream.getAudioTracks()
    if (!tracks.length) return

    const mimeType = pickAudioMimeType()
    if (!mimeType) {
      // eslint-disable-next-line no-console
      console.warn('[ai-transcriber] No WebM/Opus support — AI transcription disabled in this browser.')
      return
    }

    let stopped = false
    let chunkIdx = 0

    // Audio-only view of the mic so the recorder doesn't try to encode video.
    const audioOnly = new MediaStream(tracks)
    audioOnlyRef.current = audioOnly

    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(audioOnly, { mimeType, audioBitsPerSecond: 32_000 })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ai-transcriber] Failed to construct MediaRecorder:', e)
      return
    }
    recRef.current = rec

    rec.ondataavailable = async (e: BlobEvent) => {
      if (stopped || !e.data || e.data.size === 0) return
      const idx = chunkIdx++
      const fd = new FormData()
      fd.append('audio', e.data, `audio-${idx}.webm`)
      fd.append('timestamp', new Date().toISOString())
      const extras = extraFieldsRef.current?.() || {}
      for (const [k, v] of Object.entries(extras)) {
        if (v !== undefined && v !== null) fd.append(k, String(v))
      }
      const reqHeaders = headersRef.current?.() || {}
      try {
        await fetch(endpoint, {
          method: 'POST',
          body: fd,
          keepalive: true,
          headers: reqHeaders,
        })
      } catch {
        // Drop the chunk on network failure — next chunk will pick up.
      }
    }

    rec.onerror = (ev: any) => {
      // eslint-disable-next-line no-console
      console.warn('[ai-transcriber] recorder error:', ev?.error || ev)
    }

    try {
      rec.start(chunkSeconds * 1000)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ai-transcriber] recorder.start failed:', e)
      return
    }

    return () => {
      stopped = true
      try { if (rec && rec.state !== 'inactive') rec.stop() } catch {}
      recRef.current = null
      audioOnlyRef.current = null
    }
  }, [enabled, micStream, endpoint, chunkSeconds])
}
