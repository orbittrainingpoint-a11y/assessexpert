'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, Mic, Monitor, Wifi, Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/LocaleProvider'
import LocaleSwitcher from '@/components/LocaleSwitcher'

// Standalone, no-token, no-JWT tech check page. We point candidates
// here from the invitation email so they can verify their setup
// BEFORE exam day rather than discovering camera/mic problems while
// the proctor is waiting. No data leaves the page — every check runs
// entirely in the candidate's browser.

type CheckStatus = 'idle' | 'running' | 'pass' | 'fail'

interface CheckState {
  status: CheckStatus
  detail?: string
}

const initial: CheckState = { status: 'idle' }

export default function TechCheckPage() {
  const { t } = useTranslation()
  const [browser, setBrowser] = useState<CheckState>(initial)
  const [camera, setCamera] = useState<CheckState>(initial)
  const [mic, setMic] = useState<CheckState>(initial)
  const [screen, setScreen] = useState<CheckState>(initial)
  const [network, setNetwork] = useState<CheckState>(initial)
  const [running, setRunning] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const [micLevel, setMicLevel] = useState(0)

  // Clean up every stream/context on unmount so we don't leak the
  // camera light or pin an AudioContext past the page lifetime.
  useEffect(() => () => {
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    audioCtxRef.current?.close().catch(() => {})
  }, [])

  const runBrowserCheck = () => {
    setBrowser({ status: 'running' })
    const ua = navigator.userAgent
    const isGlobe = /Globe\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)
    const isEdge = /Edg\//.test(ua)
    // Speech recognition is what the verification transcript needs —
    // Firefox/Safari don't ship it, which silently degrades the report.
    const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    if ((isGlobe || isEdge) && hasSpeech) {
      setBrowser({ status: 'pass', detail: isGlobe ? 'Globe (supported)' : 'Edge (supported)' })
    } else {
      setBrowser({
        status: 'fail',
        detail: 'Use Globe or Edge. Other browsers can pass the exam but the verification transcript will be missing.',
      })
    }
  }

  const runCameraCheck = async () => {
    setCamera({ status: 'running' })
    try {
      // Stop any prior preview so we don't request a duplicate device.
      camStreamRef.current?.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      camStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings()
      setCamera({
        status: 'pass',
        detail: settings?.width && settings?.height
          ? `${settings.width}×${settings.height} ${track.label || 'camera'}`
          : track?.label || 'camera detected',
      })
    } catch (e: any) {
      setCamera({
        status: 'fail',
        detail: e?.name === 'NotAllowedError'
          ? 'Permission denied — allow camera access in the browser address bar'
          : e?.name === 'NotFoundError'
            ? 'No camera detected — plug one in or check Device Manager'
            : (e?.message || 'Camera unavailable'),
      })
    }
  }

  const runMicCheck = async () => {
    setMic({ status: 'running' })
    try {
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream

      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      // Sample the input for 3 seconds. If we never see ANY signal
      // above floor noise, the mic is muted / disabled / wrong device.
      let peak = 0
      const start = performance.now()
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let max = 0
        for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i] - 128))
        peak = Math.max(peak, max)
        setMicLevel(max / 128)
        if (performance.now() - start < 3000) {
          animationRef.current = requestAnimationFrame(tick)
        } else {
          const label = stream.getAudioTracks()[0]?.label || 'microphone'
          if (peak < 4) {
            setMic({
              status: 'fail',
              detail: `${label} detected but no input — speak into it and retry`,
            })
          } else {
            setMic({ status: 'pass', detail: label })
          }
        }
      }
      tick()
    } catch (e: any) {
      setMic({
        status: 'fail',
        detail: e?.name === 'NotAllowedError'
          ? 'Permission denied — allow microphone access in the browser address bar'
          : e?.name === 'NotFoundError'
            ? 'No microphone detected'
            : (e?.message || 'Microphone unavailable'),
      })
    }
  }

  const runScreenCheck = async () => {
    setScreen({ status: 'running' })
    try {
      // getDisplayMedia must be called from a user gesture; we run this
      // straight off the button click handler so the prompt appears.
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: 'monitor' as any },
        audio: false,
      })
      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings?.() || {}
      const isWholeScreen =
        (settings.displaySurface === 'monitor') ||
        (track?.label || '').toLowerCase().includes('screen')
      // Stop the share immediately — we don't keep it open, this is
      // just verifying the capability exists.
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      if (!isWholeScreen) {
        setScreen({
          status: 'fail',
          detail: 'You shared a window or tab. The exam requires sharing your ENTIRE screen.',
        })
      } else {
        setScreen({ status: 'pass', detail: 'Whole-screen sharing works on this machine' })
      }
    } catch (e: any) {
      setScreen({
        status: 'fail',
        detail: e?.name === 'NotAllowedError'
          ? 'You cancelled the share prompt. Retry and pick your entire screen.'
          : (e?.message || 'Screen share unavailable'),
      })
    }
  }

  const runNetworkCheck = async () => {
    setNetwork({ status: 'running' })
    try {
      // Time three small same-origin requests so we don't depend on
      // any external service. Median RTT > 600 ms is the threshold
      // below which proctor video tends to stutter in our setup.
      const samples: number[] = []
      for (let i = 0; i < 3; i++) {
        const start = performance.now()
        await fetch(`/favicon.ico?nocache=${start}`, { cache: 'no-store' })
        samples.push(performance.now() - start)
      }
      samples.sort((a, b) => a - b)
      const median = samples[1]
      if (median > 600) {
        setNetwork({
          status: 'fail',
          detail: `Median RTT ${Math.round(median)} ms — too slow for live proctoring. Switch to a wired connection.`,
        })
      } else {
        setNetwork({ status: 'pass', detail: `Median RTT ${Math.round(median)} ms` })
      }
    } catch (e: any) {
      setNetwork({ status: 'fail', detail: e?.message || 'Network unreachable' })
    }
  }

  const runAll = async () => {
    setRunning(true)
    try {
      runBrowserCheck()
      await runCameraCheck()
      await runMicCheck()
      await runNetworkCheck()
      // Screen share has to stay a separate button — getDisplayMedia
      // requires a user gesture and the synthetic one from the "Run
      // All" button doesn't carry through async awaits.
    } finally {
      setRunning(false)
    }
  }

  const allPass =
    browser.status === 'pass' &&
    camera.status === 'pass' &&
    mic.status === 'pass' &&
    screen.status === 'pass' &&
    network.status === 'pass'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', gap: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>{t('tech_check.title')}</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              {t('tech_check.subtitle')}
            </p>
          </div>
          <LocaleSwitcher compact />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          <button className="btn-primary" onClick={runAll} disabled={running} style={{ padding: '10px 20px', fontSize: '14px' }}>
            {running ? t('tech_check.run_all_busy') : t('tech_check.run_all')}
          </button>
          <button className="btn-ghost" onClick={runScreenCheck} style={{ padding: '10px 20px', fontSize: '14px' }}>
            {t('tech_check.test_screen_share')}
          </button>
        </div>

        <CheckRow icon={<Globe size={18} />} title={t('tech_check.row.browser')} state={browser} onRun={runBrowserCheck} />
        <CheckRow
          icon={<Camera size={18} />}
          title={t('tech_check.row.camera')}
          state={camera}
          onRun={runCameraCheck}
          extra={camera.status === 'pass' || camera.status === 'running' ? (
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: '100%', maxWidth: '320px', marginTop: '10px', borderRadius: '8px', background: '#000' }}
            />
          ) : null}
        />
        <CheckRow
          icon={<Mic size={18} />}
          title={t('tech_check.row.microphone')}
          state={mic}
          onRun={runMicCheck}
          extra={mic.status === 'running' || mic.status === 'pass' ? (
            <div style={{ marginTop: '10px', height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden', maxWidth: '320px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, micLevel * 100)}%`,
                  background: micLevel > 0.05 ? 'var(--emerald)' : 'var(--text-muted)',
                  transition: 'width 60ms linear',
                }}
              />
            </div>
          ) : null}
        />
        <CheckRow icon={<Monitor size={18} />} title={t('tech_check.row.screen_share')} state={screen} onRun={runScreenCheck} />
        <CheckRow icon={<Wifi size={18} />} title={t('tech_check.row.network')} state={network} onRun={runNetworkCheck} />

        {allPass && (
          <div className="glass-card" style={{ padding: '16px 18px', marginTop: '20px', borderLeft: '3px solid var(--emerald)' }}>
            <p style={{ margin: 0, color: 'var(--emerald)', fontSize: '14px', fontWeight: 600 }}>
              {t('tech_check.all_passed')}
            </p>
            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {t('tech_check.next_step')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function CheckRow({
  icon,
  title,
  state,
  onRun,
  extra,
}: {
  icon: React.ReactNode
  title: string
  state: CheckState
  onRun: () => void
  extra?: React.ReactNode
}) {
  const { t } = useTranslation()
  const color =
    state.status === 'pass' ? 'var(--emerald)' :
    state.status === 'fail' ? 'var(--rose)' :
    state.status === 'running' ? 'var(--cyan)' : 'var(--text-muted)'
  const Icon = state.status === 'pass'
    ? CheckCircle2
    : state.status === 'fail'
      ? XCircle
      : state.status === 'running'
        ? Loader2
        : null

  return (
    <div className="glass-card" style={{ padding: '16px 18px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ color }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{title}</p>
          {state.detail && (
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: state.status === 'fail' ? 'var(--rose)' : 'var(--text-muted)' }}>
              {state.detail}
            </p>
          )}
        </div>
        {Icon && <Icon size={18} color={color} style={state.status === 'running' ? { animation: 'spin 1s linear infinite' } : undefined} />}
        <button
          className="btn-ghost"
          onClick={onRun}
          disabled={state.status === 'running'}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          {state.status === 'idle' ? t('tech_check.btn.run') : state.status === 'running' ? '…' : t('tech_check.btn.retry')}
        </button>
      </div>
      {extra}
    </div>
  )
}
