'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

// Operator status page — no auth needed. Renders pass/fail of the
// critical runtime dependencies so the operator can answer "is anything
// broken?" without opening DevTools. Mirrors the kind of checks a real
// candidate browser would do at start-of-call.
//
// All checks are read-only and run in the user's browser — there's no
// privileged information exposed.

type CheckStatus = 'pending' | 'ok' | 'warn' | 'fail'
type Check = { id: string; label: string; status: CheckStatus; detail?: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || ''

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([
    { id: 'api', label: 'Backend reachable', status: 'pending' },
    { id: 'turn', label: 'Cloudflare TURN credentials minting', status: 'pending' },
    { id: 'webrtc', label: 'Browser supports WebRTC', status: 'pending' },
    { id: 'media', label: 'Camera + microphone enumerated', status: 'pending' },
    { id: 'fullscreen', label: 'Fullscreen API available', status: 'pending' },
    { id: 'browser', label: 'Chromium-family browser', status: 'pending' },
  ])

  const setOne = (id: string, status: CheckStatus, detail?: string) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, status, detail } : c))
  }

  useEffect(() => {
    (async () => {
      // 1. Backend health
      try {
        const t0 = performance.now()
        const res = await fetch(`${API_URL}/health`, { cache: 'no-store' })
        const ms = (performance.now() - t0).toFixed(0)
        setOne('api', res.ok ? 'ok' : 'fail', res.ok ? `${ms} ms` : `HTTP ${res.status}`)
      } catch (e: any) {
        setOne('api', 'fail', e?.message || 'Network error')
      }

      // 2. Cloudflare TURN minting
      try {
        const res = await fetch(`${API_URL}/turn/credentials`, { cache: 'no-store' })
        if (!res.ok) { setOne('turn', 'fail', `HTTP ${res.status}`); return }
        const data = await res.json()
        const provider = data?.provider
        const count = data?.iceServers?.length || 0
        if (provider === 'cloudflare' && count > 0) {
          setOne('turn', 'ok', `${count} ICE servers from Cloudflare`)
        } else if (provider === 'none') {
          setOne('turn', 'warn', 'Cloudflare unavailable — falling back to self-hosted only')
        } else {
          setOne('turn', 'warn', 'Unexpected response shape')
        }
      } catch (e: any) {
        setOne('turn', 'fail', e?.message || 'Network error')
      }

      // 3. WebRTC support
      const hasRTC = typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
      setOne('webrtc', hasRTC ? 'ok' : 'fail', hasRTC ? 'RTCPeerConnection + getUserMedia present' : 'Not supported in this browser')

      // 4. Media devices enumerated
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter(d => d.kind === 'videoinput').length
        const mics = devices.filter(d => d.kind === 'audioinput').length
        if (cams > 0 && mics > 0) setOne('media', 'ok', `${cams} camera(s), ${mics} mic(s)`)
        else setOne('media', 'warn', `cams=${cams}, mics=${mics} — grant permissions on a real session`)
      } catch (e: any) {
        setOne('media', 'fail', e?.message || 'enumerateDevices failed')
      }

      // 5. Fullscreen API
      const fs = typeof document.documentElement.requestFullscreen === 'function'
      setOne('fullscreen', fs ? 'ok' : 'warn', fs ? 'Available' : 'Not available — exam fullscreen lock will skip')

      // 6. Browser family
      const ua = navigator.userAgent
      const isChromium = /Chrome|Edg|OPR/.test(ua) && !/Edge\/\d+/.test(ua)
      setOne('browser', isChromium ? 'ok' : 'warn', isChromium ? 'Chromium-family detected' : 'Best results in Chrome/Edge')
    })()
  }, [])

  const overall: CheckStatus = checks.some(c => c.status === 'fail') ? 'fail'
    : checks.some(c => c.status === 'pending') ? 'pending'
    : checks.some(c => c.status === 'warn') ? 'warn' : 'ok'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: 40, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 22, fontWeight: 700 }}>
          Platform Status
        </h1>
        <p style={{ margin: '6px 0 24px', color: 'var(--text-muted)', fontSize: 13 }}>
          Live diagnostics. This page runs all checks in your browser — no auth required.
        </p>

        <div style={{
          marginBottom: 24, padding: 16, borderRadius: 10,
          border: `1px solid ${overall === 'ok' ? 'rgba(5,150,105,0.3)' : overall === 'fail' ? 'rgba(225,29,72,0.3)' : 'rgba(217,119,6,0.3)'}`,
          background: overall === 'ok' ? 'rgba(5,150,105,0.06)' : overall === 'fail' ? 'rgba(225,29,72,0.06)' : 'rgba(217,119,6,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Indicator status={overall} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {overall === 'ok' ? 'All systems operational' :
               overall === 'fail' ? 'One or more checks failed' :
               overall === 'warn' ? 'Operational with warnings' : 'Running checks…'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {checks.filter(c => c.status === 'ok').length} of {checks.length} checks passed
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checks.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 8,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Indicator status={c.status} />
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{c.label}</div>
                  {c.detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.detail}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          API: <code>{API_URL || '(empty)'}</code><br/>
          WS: <code>{WS_URL || '(empty)'}</code><br/>
          Build: <code>{process.env.NEXT_PUBLIC_BUILD_ID || '(unset)'}</code>
        </div>
      </div>
    </div>
  )
}

function Indicator({ status }: { status: CheckStatus }) {
  if (status === 'ok') return <CheckCircle2 size={18} color="var(--emerald)" />
  if (status === 'fail') return <XCircle size={18} color="var(--rose)" />
  if (status === 'warn') return <AlertCircle size={18} color="var(--amber)" />
  return <Loader2 size={18} className="animate-spin" color="var(--text-muted)" />
}
