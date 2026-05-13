'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Drop-in replacement for the old useLivekit hook.
 *
 * Uses lib-jitsi-meet under the hood (Strophe / XMPP / WebRTC).
 *
 * lib-jitsi-meet doesn't ship usable types, so this file leans on `any` for the
 * Jitsi API surface. The PUBLIC shape returned to React components matches
 * useLivekit exactly so existing UI code keeps working.
 */

declare global {
  interface Window {
    JitsiMeetJS: any
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export interface RemotePeer {
  identity: string
  name: string
  role: 'PROCTOR' | 'CANDIDATE' | 'OBSERVER'
  candidateId?: string
  cameraTrack: MediaStreamTrack | null
  micTrack: MediaStreamTrack | null
  screenTrack: MediaStreamTrack | null
  cameraStream: MediaStream | null
  screenStream: MediaStream | null
}

interface UseJitsiOptions {
  enabled: boolean
  role: 'PROCTOR' | 'CANDIDATE'
  sessionId?: string
  magicToken?: string
  jwtToken?: string
  publishCamera?: boolean
  publishMic?: boolean
  publishScreen?: boolean
}

// Public ConnectionState — matches the names LiveKit used so the rest of the app
// doesn't need to learn new enum values.
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
}

type LocalTracks = {
  video: any | null
  audio: any | null
  screen: any | null
}

export function useJitsi({
  enabled,
  role,
  sessionId,
  magicToken,
  jwtToken,
  publishCamera = true,
  publishMic = true,
  publishScreen = false,
}: UseJitsiOptions) {
  const connectionRef = useRef<any>(null)
  const conferenceRef = useRef<any>(null)
  const localTracksRef = useRef<LocalTracks>({ video: null, audio: null, screen: null })
  const remoteTracksRef = useRef<Map<string, { video?: any; audio?: any; screen?: any; name?: string }>>(new Map())
  const initializedRef = useRef(false)

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null)
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [screenShareActive, setScreenShareActive] = useState(false)

  const parseRole = (identity: string): 'PROCTOR' | 'CANDIDATE' | 'OBSERVER' => {
    if (identity.startsWith('proctor-')) return 'PROCTOR'
    if (identity.startsWith('candidate-')) return 'CANDIDATE'
    return 'OBSERVER'
  }
  const parseCandidateId = (identity: string): string | undefined =>
    identity.startsWith('candidate-') ? identity.replace('candidate-', '') : undefined

  // Build the public peers map from remoteTracksRef
  const rebuildPeers = useCallback(() => {
    const next = new Map<string, RemotePeer>()
    remoteTracksRef.current.forEach((tracks, identity) => {
      const camMS: MediaStreamTrack | null = tracks.video?.stream?.getVideoTracks?.()[0] ?? null
      const micMS: MediaStreamTrack | null = tracks.audio?.stream?.getAudioTracks?.()[0] ?? null
      const scrMS: MediaStreamTrack | null = tracks.screen?.stream?.getVideoTracks?.()[0] ?? null
      next.set(identity, {
        identity,
        name: tracks.name || identity,
        role: parseRole(identity),
        candidateId: parseCandidateId(identity),
        cameraTrack: camMS,
        micTrack: micMS,
        screenTrack: scrMS,
        cameraStream: camMS ? new MediaStream(micMS ? [camMS, micMS] : [camMS]) : null,
        screenStream: scrMS ? new MediaStream([scrMS]) : null,
      })
    })
    setPeers(next)
  }, [])

  // Load lib-jitsi-meet from the Jitsi server's /libs path. The npm package
  // 'lib-jitsi-meet' is a deprecated stub and does NOT expose JitsiMeetJS —
  // the only reliable source is the same Jitsi web container that serves your
  // meeting room. This URL works because Apache proxies / → jitsi-web:80 and
  // jitsi-web ships lib-jitsi-meet.min.js under /libs.
  const loadJitsi = async (publicHost: string) => {
    if (typeof window === 'undefined') return null
    if (window.JitsiMeetJS) return window.JitsiMeetJS

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-jitsi-lib]`)
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('lib-jitsi-meet script load failed')), { once: true })
        return
      }
      const s = document.createElement('script')
      s.src = `https://${publicHost}/libs/lib-jitsi-meet.min.js`
      s.async = true
      s.dataset.jitsiLib = '1'
      s.onload = () => resolve()
      s.onerror = () => reject(new Error(`Failed to load ${s.src}`))
      document.head.appendChild(s)
    })

    if (!window.JitsiMeetJS) {
      throw new Error('lib-jitsi-meet loaded but window.JitsiMeetJS is undefined')
    }
    return window.JitsiMeetJS
  }

  const startScreenShare = useCallback(async () => {
    const conf = conferenceRef.current
    const J = window.JitsiMeetJS
    if (!conf || !J) return false
    try {
      const tracks = await J.createLocalTracks({ devices: ['desktop'] })
      const screenTrack = tracks?.[0]
      if (!screenTrack) return false
      localTracksRef.current.screen = screenTrack
      await conf.addTrack(screenTrack)
      const ms = new MediaStream([screenTrack.stream.getVideoTracks()[0]])
      setLocalScreenStream(ms)
      setScreenShareActive(true)
      // Auto-detect "stop sharing" from the browser UI
      ms.getVideoTracks()[0].addEventListener('ended', () => {
        try { conf.removeTrack(screenTrack) } catch {}
        localTracksRef.current.screen = null
        setLocalScreenStream(null)
        setScreenShareActive(false)
      })
      return true
    } catch (e: any) {
      setError(`Screen share failed: ${e?.message || e}`)
      return false
    }
  }, [])

  const stopScreenShare = useCallback(async () => {
    const conf = conferenceRef.current
    const t = localTracksRef.current.screen
    if (!conf || !t) return
    try { await conf.removeTrack(t); await t.dispose() } catch {}
    localTracksRef.current.screen = null
    setLocalScreenStream(null)
    setScreenShareActive(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (role === 'PROCTOR' && (!sessionId || !jwtToken)) return
    if (role === 'CANDIDATE' && !magicToken) return

    let cancelled = false
    setConnectionState(ConnectionState.Connecting)

    ;(async () => {
      try {
        // 1) Fetch token+room+domain from backend FIRST (we need publicUrl to
        // know where to load lib-jitsi-meet from).
        const tokenUrl = role === 'PROCTOR'
          ? `${API_URL}/jitsi/proctor-token?sessionId=${sessionId}`
          : `${API_URL}/jitsi/candidate-token?magicToken=${magicToken}`
        const headers: Record<string, string> = {}
        if (role === 'PROCTOR' && jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`
        const res = await fetch(tokenUrl, { headers })
        if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
        const { token, domain, publicUrl, room } = await res.json()
        if (cancelled) return

        // The XMPP domain (internal, e.g. "meet.jitsi") is what prosody expects
        // in JWT.sub and what JitsiConnection uses for hosts.*. The public URL
        // (e.g. "https://meet.assessexpert.com") is where the websocket and the
        // lib-jitsi-meet script live. They are different — must not be conflated.
        const publicHost = (publicUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
        if (!publicHost) throw new Error('Backend did not return publicUrl for Jitsi')

        // 2) Load lib-jitsi-meet from the Jitsi server
        const J = await loadJitsi(publicHost)
        if (cancelled || !J) return

        if (!initializedRef.current) {
          J.init({ disableAudioLevels: true })
          J.setLogLevel(J.logLevels.ERROR)
          initializedRef.current = true
        }

        // 3) Connect to the XMPP server
        const connection = new J.JitsiConnection(null, token, {
          hosts: {
            domain,
            muc: `conference.${domain}`,
            focus: `focus.${domain}`,
          },
          serviceUrl: `wss://${publicHost}/xmpp-websocket?room=${room}`,
          clientNode: 'https://assessexpert.com',
          enableP2P: false,
        })
        connectionRef.current = connection

        connection.addEventListener(J.events.connection.CONNECTION_FAILED, (err: any) => {
          if (!cancelled) {
            setError(`Jitsi connection failed: ${err?.message || err}`)
            setConnectionState(ConnectionState.Disconnected)
          }
        })

        await new Promise<void>((resolve, reject) => {
          const established = () => { resolve() }
          const failed = (e: any) => reject(new Error(`Connection failed: ${e}`))
          connection.addEventListener(J.events.connection.CONNECTION_ESTABLISHED, established)
          connection.addEventListener(J.events.connection.CONNECTION_FAILED, failed)
          connection.connect({})
        })
        if (cancelled) return

        // 3) Join the conference room
        const conference = connection.initJitsiConference(room, {
          openBridgeChannel: true,
          p2p: { enabled: false },
        })
        conferenceRef.current = conference

        // Track callbacks — feed remoteTracksRef and re-emit
        const onRemoteTrackAdded = (track: any) => {
          if (track.isLocal()) return
          const id = track.getParticipantId()
          // resolve a human-readable identity from the participant's user info
          const part = conference.getParticipantById(id)
          const ctxUser = part?._identity?.user || part?.getProperty?.('user')
          const identity = ctxUser?.id || id
          const slot: { video?: any; audio?: any; screen?: any; name?: string } =
            remoteTracksRef.current.get(identity) || { name: ctxUser?.name || identity }
          if (track.getType() === 'audio') slot.audio = track
          else if (track.getVideoType() === 'desktop') slot.screen = track
          else slot.video = track
          remoteTracksRef.current.set(identity, slot)
          rebuildPeers()
        }
        const onRemoteTrackRemoved = (track: any) => {
          if (track.isLocal()) return
          const part = conference.getParticipantById(track.getParticipantId())
          const ctxUser = part?._identity?.user || part?.getProperty?.('user')
          const identity = ctxUser?.id || track.getParticipantId()
          const slot = remoteTracksRef.current.get(identity)
          if (!slot) return
          if (track.getType() === 'audio') slot.audio = undefined
          else if (track.getVideoType() === 'desktop') slot.screen = undefined
          else slot.video = undefined
          remoteTracksRef.current.set(identity, slot)
          rebuildPeers()
        }
        const onParticipantLeft = (id: string) => {
          // Walk the map and drop any entry whose tracks all came from this id
          // (we keyed by user identity not jitsi-id, so do a soft cleanup)
          const part = conference.getParticipantById(id)
          const ctxUser = part?._identity?.user || part?.getProperty?.('user')
          const identity = ctxUser?.id || id
          remoteTracksRef.current.delete(identity)
          rebuildPeers()
        }
        const onConferenceJoined = () => {
          setConnectionState(ConnectionState.Connected)
        }
        const onConferenceFailed = (err: any) => {
          setError(`Conference join failed: ${err?.message || err}`)
        }
        const onConferenceLeft = () => {
          setConnectionState(ConnectionState.Disconnected)
        }

        conference.on(J.events.conference.TRACK_ADDED, onRemoteTrackAdded)
        conference.on(J.events.conference.TRACK_REMOVED, onRemoteTrackRemoved)
        conference.on(J.events.conference.USER_LEFT, onParticipantLeft)
        conference.on(J.events.conference.CONFERENCE_JOINED, onConferenceJoined)
        conference.on(J.events.conference.CONFERENCE_FAILED, onConferenceFailed)
        conference.on(J.events.conference.CONFERENCE_LEFT, onConferenceLeft)

        conference.join()
        if (cancelled) return

        // 4) Create + publish local tracks
        const devices: string[] = []
        if (publishCamera) devices.push('video')
        if (publishMic) devices.push('audio')
        if (devices.length > 0) {
          const tracks = await J.createLocalTracks({ devices })
          if (cancelled) {
            tracks.forEach((t: any) => t.dispose())
            return
          }
          for (const t of tracks) {
            if (t.getType() === 'audio') localTracksRef.current.audio = t
            else localTracksRef.current.video = t
            await conference.addTrack(t)
          }
          // Build local MediaStream for PIP/preview compatibility
          const camTrack = localTracksRef.current.video?.stream?.getVideoTracks?.()[0]
          const micTrack = localTracksRef.current.audio?.stream?.getAudioTracks?.()[0]
          if (camTrack) {
            setLocalCameraStream(new MediaStream(micTrack ? [camTrack, micTrack] : [camTrack]))
          }
        }
        if (publishScreen) await startScreenShare()
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Jitsi connection failed')
          setConnectionState(ConnectionState.Disconnected)
        }
      }
    })()

    return () => {
      cancelled = true
      const conf = conferenceRef.current
      const conn = connectionRef.current
      const { video, audio, screen } = localTracksRef.current
      try { video?.dispose?.() } catch {}
      try { audio?.dispose?.() } catch {}
      try { screen?.dispose?.() } catch {}
      try { conf?.leave?.() } catch {}
      try { conn?.disconnect?.() } catch {}
      conferenceRef.current = null
      connectionRef.current = null
      localTracksRef.current = { video: null, audio: null, screen: null }
      remoteTracksRef.current.clear()
      setPeers(new Map())
      setLocalCameraStream(null)
      setLocalScreenStream(null)
      setConnectionState(ConnectionState.Disconnected)
    }
  // We deliberately exclude the publishX flags from deps — toggling them mid-call
  // would tear down the whole room; the consumer should adjust enabled instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, role, sessionId, magicToken, jwtToken])

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.Connected,
    localCameraStream,
    localScreenStream,
    peers,
    error,
    startScreenShare,
    stopScreenShare,
    screenShareActive,
  }
}

// Back-compat alias so existing imports of useLivekit keep working without
// touching consumer files.
export { useJitsi as useLivekit }
