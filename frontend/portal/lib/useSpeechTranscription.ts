'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Continuous speech-to-text via the browser SpeechRecognition API.
 *
 * Only captures the LOCAL microphone (this browser's mic). To get both
 * sides of a verification conversation, run this on BOTH the proctor's
 * page and the candidate's page; each side sends their own utterances
 * to the backend and the report stitches them together by timestamp.
 *
 * Works in Chrome/Edge. Firefox/Safari fall back gracefully — the hook
 * just returns supported=false and never fires onUtterance.
 */

interface Options {
  enabled: boolean
  /** Called once per finalised utterance — pass these to the backend. */
  onUtterance?: (text: string) => void
  /** BCP-47 language tag. Default: en-US. */
  lang?: string
}

type SR = any
declare global {
  interface Window {
    SpeechRecognition?: { new (): SR }
    webkitSpeechRecognition?: { new (): SR }
  }
}

export function useSpeechTranscription({ enabled, onUtterance, lang = 'en-US' }: Options) {
  const recogRef = useRef<SR | null>(null)
  const [supported, setSupported] = useState<boolean>(true)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const onUtteranceRef = useRef(onUtterance)
  onUtteranceRef.current = onUtterance

  const SpeechRecognitionCtor = typeof window === 'undefined'
    ? undefined
    : (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!SpeechRecognitionCtor) {
      setSupported(false)
      return
    }
    if (!enabled) return

    const recog: SR = new SpeechRecognitionCtor()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = lang
    recogRef.current = recog

    recog.onresult = (event: any) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const t = (res[0]?.transcript || '').trim()
        if (!t) continue
        if (res.isFinal) {
          // Final utterance — emit to consumer
          try { onUtteranceRef.current?.(t) } catch {}
        } else {
          interimText = t
        }
      }
      setInterim(interimText)
    }

    recog.onerror = (e: any) => {
      // 'no-speech' fires constantly on silence — don't spam
      if (e?.error === 'no-speech' || e?.error === 'aborted') return
      // Otherwise log once and let onend restart us
      // eslint-disable-next-line no-console
      console.warn('[transcription] error:', e?.error)
    }

    recog.onstart = () => setListening(true)
    recog.onend = () => {
      setListening(false)
      // Auto-restart if we're still meant to be running
      if (recogRef.current === recog && enabled) {
        try { recog.start() } catch {}
      }
    }

    try { recog.start() } catch {}

    return () => {
      recogRef.current = null
      try { recog.onend = null } catch {}
      try { recog.stop() } catch {}
    }
  }, [enabled, lang, SpeechRecognitionCtor])

  const stop = useCallback(() => {
    const r = recogRef.current
    recogRef.current = null
    try { if (r) r.onend = null } catch {}
    try { r?.stop() } catch {}
    setListening(false)
  }, [])

  return { supported, listening, interim, stop }
}
