'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Pure WebRTC hook.
 *
 * IMPORTANT: Uses the EXISTING Socket.IO socket passed in via `socket` prop
 * instead of creating its own connection. This avoids the dual-socket problem
 * where signalling events were going to a different socket than the one in
 * the session room.
 *
 * If no socket is passed (e.g. candidate page before socket is ready),
 * it falls back to creating its own socket — but the preferred path is
 * always to pass the existing socket.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

// Use a TURN server for VPS/production where direct P2P UDP is blocked.
// Falls back to STUN-only if TURN credentials are not set.
//
// TURN host derivation:
// - Default: derived from NEXT_PUBLIC_WS_URL (e.g. assessexpert.com).
// - NEXT_PUBLIC_TURN_HOST overrides — used so the firewall-friendly
//   TURN-over-TLS-on-443 endpoint can live on a dedicated subdomain
//   (e.g. turn.assessexpert.com) without changing the API/WS host.
// - Etisalat / corporate / hospital networks block 3478 and 5349 — only
//   80/443 are universally allowed. The `turns:…:443?transport=tcp`
//   entry rides on the standard HTTPS port via nginx SNI multiplexing
//   in front of coturn, so candidates on locked-down networks still
//   reach the relay.
const TURN_SECRET = process.env.NEXT_PUBLIC_TURN_SECRET || ''
const TURN_SERVER = process.env.NEXT_PUBLIC_TURN_SERVER ||
  (process.env.NEXT_PUBLIC_WS_URL || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '')

// Baseline ICE servers — STUN + self-hosted coturn. Always present so the
// connection still works for candidates on permissive networks even if the
// Cloudflare fetch hasn't returned yet.
const BASE_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(TURN_SECRET && TURN_SERVER ? [{
    urls: [
      `turn:${TURN_SERVER}:3478?transport=udp`,
      `turn:${TURN_SERVER}:3478?transport=tcp`,
      `turns:${TURN_SERVER}:5349?transport=tcp`,
    ],
    username: 'assessexpert',
    credential: TURN_SECRET,
  }] : []),
]

// Cloudflare TURN — fetched at runtime from /api/turn/credentials, which
// mints short-lived credentials via Cloudflare's API. This is the
// firewall-bypass path: Cloudflare TURN runs on 443 over TLS from every
// PoP, so candidates on Etisalat / corporate / hospital networks (which
// block 3478/5349 but always allow 443) can still reach a relay.
//
// One module-level promise so we mint credentials exactly once per page
// load no matter how many hooks/peers ask. Refreshed implicitly when the
// page reloads (well before the 24h Cloudflare TTL).
let cloudflareIcePromise: Promise<RTCIceServer[]> | null = null
async function fetchCloudflareIce(): Promise<RTCIceServer[]> {
  if (!cloudflareIcePromise) {
    cloudflareIcePromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/turn/credentials`)
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data?.iceServers) ? data.iceServers : []
      } catch {
        return []
      }
    })()
  }
  return cloudflareIcePromise
}

export interface RemotePeer {
  identity: string
  name: string
  role: 'PROCTOR' | 'CANDIDATE' | 'OBSERVER'
  candidateId?: string
  // Socket.io id of the remote peer. Needed by the proctor UI so it
  // can pass activeTargetSocketId back to useJitsi when the proctor
  // selects an active candidate during verification (1-to-1 routing).
  // Without this, the proctor's React state had no way to know each
  // candidate's socket id and fell back to a buggy identity-as-socketId
  // approximation that broke outbound audio routing.
  socketId: string
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
  /**
   * Specific candidate that THIS browser represents. Required for
   * multi-candidate slots where multiple candidates share one magicToken —
   * without it, every candidate would identify as the primary and collide.
   */
  candidateId?: string
  /**
   * PROCTOR ONLY. When set, the proctor's outbound audio + video is sent
   * ONLY to the peer with this socket id; all other peers receive a muted
   * (black-frame + silence) stream until the proctor switches to them.
   * Leave undefined to broadcast to everyone (e.g. during MCQ monitoring).
   */
  activeTargetSocketId?: string
  publishCamera?: boolean
  publishMic?: boolean
  publishScreen?: boolean
  /** Pass the existing socket from useSessionWebSocket to avoid dual-socket issues */
  socket?: any
}

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
}

interface PeerConn {
  pc: RTCPeerConnection
  socketId: string
  identity: string
  cameraStream: MediaStream | null
  screenStream: MediaStream | null
  // Per-peer CLONES of the local camera + mic tracks. Cloning lets us
  // independently enable/disable the outbound stream PER peer, so the
  // proctor can route audio/video to just the active candidate while
  // other candidates receive a muted feed.
  localVideoClone: MediaStreamTrack | null
  localAudioClone: MediaStreamTrack | null
}

let ioModule: any = null
const getIo = async () => {
  if (!ioModule) {
    const mod = await import('socket.io-client')
    ioModule = mod.io
  }
  return ioModule
}

export function useJitsi({
  enabled,
  role,
  sessionId,
  magicToken,
  jwtToken,
  candidateId,
  activeTargetSocketId,
  publishCamera = true,
  publishMic = true,
  publishScreen = false,
  socket: externalSocket,
}: UseJitsiOptions) {
  const activeTargetRef = useRef<string | undefined>(activeTargetSocketId)
  activeTargetRef.current = activeTargetSocketId
  const ownSocketRef = useRef<any>(null)   // only used if no external socket
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnsRef = useRef<Map<string, PeerConn>>(new Map())
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const myIdentityRef = useRef('')
  // socketId → candidateId cache, populated from peer.joined announcements.
  // The proctor uses this in handleOffer to build a candidate-${candidateId}
  // identity (so the React side can look up tiles by database id) instead
  // of candidate-${socketId} (which the React side has no way to match).
  const socketIdToCandidateIdRef = useRef<Map<string, string>>(new Map())
  // Latest candidateId in a ref so every announce (initial, on connect,
  // re-announce, reconnect) reads the up-to-date value instead of the
  // stale prop captured in a useEffect closure at mount time.
  const candidateIdRef = useRef<string | undefined>(candidateId)
  candidateIdRef.current = candidateId
  // Resolved ICE servers = BASE_ICE_SERVERS + (Cloudflare TURN once fetched).
  // Initialised with the base list so a PeerConnection created before the
  // Cloudflare fetch returns still has working STUN + self-hosted TURN.
  const iceServersRef = useRef<RTCIceServer[]>(BASE_ICE_SERVERS)

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null)
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [screenShareActive, setScreenShareActive] = useState(false)

  const mySocketIdRef = useRef<string>('')

  const getSocket = useCallback(() => externalSocket || ownSocketRef.current, [externalSocket])
  const getMySocketId = useCallback(() => {
    const sock = getSocket()
    return sock?.id || mySocketIdRef.current
  }, [getSocket])

  const parseRole = (id: string): 'PROCTOR' | 'CANDIDATE' | 'OBSERVER' => {
    if (id.startsWith('proctor-')) return 'PROCTOR'
    if (id.startsWith('candidate-')) return 'CANDIDATE'
    return 'OBSERVER'
  }
  const parseCandidateId = (id: string) =>
    id.startsWith('candidate-') ? id.replace('candidate-', '') : undefined

  const rebuildPeers = useCallback(() => {
    const next = new Map<string, RemotePeer>()
    peerConnsRef.current.forEach((conn) => {
      // If the PeerConn identity is still socketId-based (offer arrived
      // before peer.joined brought the real candidateId), check the
      // socketId→candidateId cache and upgrade. This ensures the React
      // side can look up the peer by `candidate-${databaseId}` even
      // during the brief race window between offer and peer.joined.
      const cachedCid = socketIdToCandidateIdRef.current.get(conn.socketId)
      let identity = conn.identity
      const role = parseRole(identity)
      let cid = parseCandidateId(identity)
      if (role === 'CANDIDATE' && cachedCid && cid !== cachedCid) {
        identity = `candidate-${cachedCid}`
        cid = cachedCid
        conn.identity = identity
      }

      next.set(identity, {
        identity,
        name: identity,
        role,
        candidateId: cid,
        socketId: conn.socketId,
        cameraTrack: conn.cameraStream?.getVideoTracks()[0] || null,
        micTrack: conn.cameraStream?.getAudioTracks()[0] || null,
        screenTrack: conn.screenStream?.getVideoTracks()[0] || null,
        cameraStream: conn.cameraStream,
        screenStream: conn.screenStream,
      })
    })
    setPeers(next)
  }, [])

  const createPeerConn = useCallback((remoteSocketId: string, remoteIdentity: string): PeerConn => {
    // Close existing connection for this peer if any
    const existing = peerConnsRef.current.get(remoteSocketId)
    if (existing) { try { existing.pc.close() } catch {} }

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
    const conn: PeerConn = {
      pc, socketId: remoteSocketId, identity: remoteIdentity,
      cameraStream: null, screenStream: null,
      localVideoClone: null, localAudioClone: null,
    }
    peerConnsRef.current.set(remoteSocketId, conn)

    // Add local tracks — CLONE per peer so we can independently enable/disable
    // each outbound stream. Without clones, .enabled is shared across all PCs.
    if (localStreamRef.current) {
      const videoSrc = localStreamRef.current.getVideoTracks()[0]
      const audioSrc = localStreamRef.current.getAudioTracks()[0]
      if (videoSrc) {
        const v = videoSrc.clone()
        conn.localVideoClone = v
        try {
          const sender = pc.addTrack(v, localStreamRef.current)
          // Bump the outbound video bitrate so the 1080p capture isn't
          // throttled to the default ~700kbps. The browser scales down on
          // congested links so this is a ceiling, not a floor. Done with
          // a deferred microtask so the addTrack always succeeds first
          // even if setParameters rejects on a stricter browser.
          queueMicrotask(() => {
            try {
              const params = sender.getParameters()
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}]
              }
              params.encodings[0].maxBitrate = 2_000_000
              sender.setParameters(params).catch(() => {})
            } catch {}
          })
        } catch {}
      }
      if (audioSrc) {
        const a = audioSrc.clone()
        conn.localAudioClone = a
        try {
          const sender = pc.addTrack(a, localStreamRef.current)
          // Bump Opus past its default ~32kbps for clearer voice.
          queueMicrotask(() => {
            try {
              const params = sender.getParameters()
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}]
              }
              params.encodings[0].maxBitrate = 64_000
              sender.setParameters(params).catch(() => {})
            } catch {}
          })
        } catch {}
      }

      // Apply initial routing: if PROCTOR has selected an active candidate and
      // this peer is NOT that one, mute the clones immediately.
      if (role === 'PROCTOR' && activeTargetRef.current && remoteSocketId !== activeTargetRef.current) {
        if (conn.localVideoClone) conn.localVideoClone.enabled = false
        if (conn.localAudioClone) conn.localAudioClone.enabled = false
      }
    }

    pc.onicecandidate = (e) => {
      if (!e.candidate) return
      const sock = getSocket()
      if (sock?.connected) {
        sock.emit('webrtc.ice', {
          sessionId: sessionIdRef.current,
          targetId: remoteSocketId,
          candidate: e.candidate,
        })
      }
    }

    pc.ontrack = (e) => {
      // Tracks from the same source MediaStream (camera+mic bundle) arrive
      // in any ORDER. The previous order-dependent logic put audio-first
      // arrivals into cameraStream and then mis-classified the video as
      // screen, leaving the proctor with a silent or invisible tile. Key
      // off the inbound MediaStream's id instead so cam vs screen is
      // unambiguous regardless of which track lands first.
      const inbound = e.streams[0]
      if (inbound) {
        if (!conn.cameraStream) {
          conn.cameraStream = inbound
        } else if (conn.cameraStream.id !== inbound.id) {
          // A different MediaStream — that's the screen share.
          conn.screenStream = inbound
        }
        // Same stream id as cameraStream → the track was added to it
        // automatically by the browser, nothing for us to do.
      } else {
        // No bundled stream (rare). Synthesise one from the loose track.
        const synth = new MediaStream([e.track])
        if (e.track.kind === 'video') {
          if (!conn.cameraStream) conn.cameraStream = synth
          else conn.screenStream = synth
        } else if (conn.cameraStream) {
          try { conn.cameraStream.addTrack(e.track) } catch {}
        } else {
          conn.cameraStream = synth
        }
      }
      // Proctor: mute incoming audio from non-active candidates as soon as
      // the track arrives so the proctor never hears someone they haven't
      // selected. The routing effect re-applies on every switch, but this
      // catches new peers that connect while another candidate is active.
      if (role === 'PROCTOR' && e.track.kind === 'audio' && activeTargetRef.current && remoteSocketId !== activeTargetRef.current) {
        e.track.enabled = false
      }
      rebuildPeers()
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectionState(ConnectionState.Connected)
      }
      if (pc.connectionState === 'failed') {
        // Try ICE restart
        pc.restartIce()
      }
      if (pc.connectionState === 'closed') {
        // Free per-peer track clones
        try { conn.localVideoClone?.stop() } catch {}
        try { conn.localAudioClone?.stop() } catch {}
        peerConnsRef.current.delete(remoteSocketId)
        rebuildPeers()
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') pc.restartIce()
        }, 3000)
      }
    }

    return conn
  }, [rebuildPeers, getSocket])

  // CANDIDATE: re-announce whenever candidateId resolves AFTER mount.
  // useLivekit captures candidateId once at mount, but in multi-candidate
  // slots `sessionState.candidate.id` typically populates only after OTP
  // verification. Without this re-announce the initial peer.announce
  // carries candidateId=undefined → the proctor's cache misses → the peer
  // is stuck keyed by socketId → the proctor's tile shows the wrong/no
  // stream. Re-emitting peer.announce with the resolved id triggers a
  // fresh peer.joined to everyone in the room, and the proctor's
  // handlePeerJoined upgrades the cached identity in-place.
  useEffect(() => {
    if (role !== 'CANDIDATE') return
    if (!candidateId || !sessionId) return
    const sock = getSocket()
    if (!sock) return
    const emit = () => sock.emit('peer.announce', {
      sessionId, role, socketId: sock.id, candidateId: candidateIdRef.current,
    })
    if (sock.connected) {
      emit()
    } else {
      // Socket isn't connected YET. Queue the announce on the next
      // 'connect' so the proctor's cache still gets the real candidateId
      // when the socket comes up. Cleanup detaches it if the effect re-runs.
      sock.once('connect', emit)
      return () => { try { sock.off('connect', emit) } catch {} }
    }
  }, [candidateId, role, sessionId, getSocket])

  // Proctor 1-to-1 routing: when the proctor picks an active candidate,
  // mute the outbound audio/video to every OTHER candidate. Inactive
  // candidates see frozen video + silence until the proctor switches.
  // No selection (undefined) → broadcast to all (default during MCQ).
  useEffect(() => {
    if (role !== 'PROCTOR') return
    activeTargetRef.current = activeTargetSocketId
    peerConnsRef.current.forEach((conn, peerSocketId) => {
      const isActive = !activeTargetSocketId || peerSocketId === activeTargetSocketId
      // Outbound: proctor's audio/video to this peer
      if (conn.localVideoClone) conn.localVideoClone.enabled = isActive
      if (conn.localAudioClone) conn.localAudioClone.enabled = isActive
      // Inbound: mute incoming audio from non-active candidates so the
      // proctor only hears the candidate they are currently verifying.
      const remoteAudio = conn.cameraStream?.getAudioTracks()?.[0]
      if (remoteAudio) remoteAudio.enabled = isActive
    })
  }, [activeTargetSocketId, role])

  const initiateOffer = useCallback(async (remoteSocketId: string, remoteIdentity: string) => {
    const conn = createPeerConn(remoteSocketId, remoteIdentity)
    try {
      const offer = await conn.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
      await conn.pc.setLocalDescription(offer)
      const sock = getSocket()
      sock?.emit('webrtc.offer', {
        sessionId: sessionIdRef.current,
        targetId: remoteSocketId,
        offer,
      })
    } catch (e: any) {
      setError(`Offer failed: ${e.message}`)
    }
  }, [createPeerConn, getSocket])

  const startScreenShare = useCallback(async () => {
    try {
      // Enforce entire screen (monitor) — not a window or tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',  // forces full screen selection
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 5, max: 10 }, // low fps to save bandwidth
        } as any,
        audio: false,
      })
      // Reject if candidate chose a window/tab instead of entire screen
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings() as any
      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        stream.getTracks().forEach(t => t.stop())
        setError('Please share your ENTIRE SCREEN, not a window or tab.')
        return false
      }
      screenStreamRef.current = stream
      setLocalScreenStream(stream)
      setScreenShareActive(true)

      peerConnsRef.current.forEach(async (conn) => {
        stream.getTracks().forEach(t => { try { conn.pc.addTrack(t, stream) } catch {} })
        try {
          const offer = await conn.pc.createOffer()
          await conn.pc.setLocalDescription(offer)
          getSocket()?.emit('webrtc.offer', {
            sessionId: sessionIdRef.current,
            targetId: conn.socketId,
            offer,
          })
        } catch {}
      })

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        screenStreamRef.current = null
        setLocalScreenStream(null)
        setScreenShareActive(false)
      })
      return true
    } catch (e: any) {
      setError(`Screen share failed: ${e.message}`)
      return false
    }
  }, [getSocket])

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    setLocalScreenStream(null)
    setScreenShareActive(false)
  }, [])

  // ── WebRTC signalling event handlers ─────────────────────────────────────
  // These are attached to whichever socket is active (external or own)
  const handlePeerJoined = useCallback((data: { peerId: string; peerRole: string; candidateId?: string }) => {
    const mySocketId = getMySocketId()
    // Ignore self — filter by socket ID AND by role (never connect to same role)
    if (data.peerId === mySocketId) return
    if (data.peerRole === role) return  // proctor never connects to another proctor

    // Cache the socketId → candidateId mapping for later use in
    // handleOffer. The candidate's offer arrives with only the socketId
    // (data.fromId), but we want to key the PC by candidate database id
    // so the React side can match streams to SessionCandidate rows.
    if (data.peerRole === 'CANDIDATE' && data.candidateId) {
      socketIdToCandidateIdRef.current.set(data.peerId, data.candidateId)
      // If the candidate's offer already arrived (before this peer.joined),
      // its PeerConn was keyed by `candidate-${socketId}` as a fallback.
      // Now that we know the real database id, upgrade the identity so the
      // proctor's React tiles match by candidateId — otherwise that peer
      // stays socketId-keyed forever and its tile never binds, leaving the
      // grid showing only the candidates that happened to match.
      const existing = peerConnsRef.current.get(data.peerId)
      if (existing && existing.identity === `candidate-${data.peerId}`) {
        existing.identity = `candidate-${data.candidateId}`
        rebuildPeers()
      }
    }

    // GLARE PREVENTION — only the CANDIDATE side initiates the offer.
    // Before this guard, both proctor and candidate called initiateOffer
    // on the same peer.joined event, so each ended up with a PC in
    // `have-local-offer` state when the other's offer arrived. The
    // setRemoteDescription on the conflicting state threw, leaving ONE
    // direction broken — exactly the "proctor can't see candidate but
    // candidate can see proctor" symptom we kept hitting in prod. With
    // candidate-always-offers, the proctor simply waits for an incoming
    // webrtc.offer and answers via handleOffer.
    if (role !== 'CANDIDATE') return

    const remoteIdentity = `proctor-${data.peerId}`
    setTimeout(() => initiateOffer(data.peerId, remoteIdentity), 500)
  }, [getMySocketId, role, initiateOffer, rebuildPeers])

  const handleOffer = useCallback(async (data: { fromId: string; offer: RTCSessionDescriptionInit }) => {
    // Ignore offers from ourselves
    if (data.fromId === getMySocketId()) return
    let conn = peerConnsRef.current.get(data.fromId)
    if (!conn) {
      // Build the identity. For the PROCTOR receiving a candidate's
      // offer we prefer the candidate's database id (cached from the
      // earlier peer.joined). Without that we fall back to the raw
      // socketId so the connection still works — the React tile just
      // won't match by candidateId until rebuildPeers runs again.
      let remoteIdentity: string
      if (role === 'PROCTOR') {
        const cid = socketIdToCandidateIdRef.current.get(data.fromId)
        remoteIdentity = cid ? `candidate-${cid}` : `candidate-${data.fromId}`
      } else {
        remoteIdentity = `proctor-${data.fromId}`
      }
      conn = createPeerConn(data.fromId, remoteIdentity)
    }
    try {
      await conn.pc.setRemoteDescription(new RTCSessionDescription(data.offer))
      const answer = await conn.pc.createAnswer()
      await conn.pc.setLocalDescription(answer)
      getSocket()?.emit('webrtc.answer', {
        sessionId: sessionIdRef.current,
        targetId: data.fromId,
        answer,
      })
    } catch (e: any) {
      setError(`Answer failed: ${e.message}`)
    }
  }, [role, createPeerConn, getSocket, getMySocketId])

  const handleAnswer = useCallback(async (data: { fromId: string; answer: RTCSessionDescriptionInit }) => {
    const conn = peerConnsRef.current.get(data.fromId)
    if (!conn) return
    try {
      await conn.pc.setRemoteDescription(new RTCSessionDescription(data.answer))
    } catch (e: any) {
      // Common cause: PC was in wrong signaling state for the answer
      // (e.g. closed mid-handshake). Was previously swallowed — that's
      // why "tile won't load" reports landed with no diagnostic. Now
      // it surfaces in the browser console.
      // eslint-disable-next-line no-console
      console.warn(`[useJitsi] setRemoteDescription(answer) failed for ${data.fromId}: ${e?.message || e}`)
    }
  }, [])

  const handleIce = useCallback(async (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
    const conn = peerConnsRef.current.get(data.fromId)
    if (!conn) return
    try {
      await conn.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
    } catch (e: any) {
      // ICE candidates can arrive out of order or after the PC closed;
      // log so we can see if it's persistent rather than transient.
      // eslint-disable-next-line no-console
      console.warn(`[useJitsi] addIceCandidate failed for ${data.fromId}: ${e?.message || e}`)
    }
  }, [])

  const handlePeerLeft = useCallback((data: { peerId: string }) => {
    const conn = peerConnsRef.current.get(data.peerId)
    if (conn) {
      try { conn.pc.close() } catch {}
      peerConnsRef.current.delete(data.peerId)
      rebuildPeers()
    }
    // Drop the cached socketId → candidateId entry so the next person
    // who happens to land on this socket id isn't mis-identified as the
    // candidate who just left.
    socketIdToCandidateIdRef.current.delete(data.peerId)
  }, [rebuildPeers])

  // ── Attach signalling handlers to external socket when it becomes available
  useEffect(() => {
    if (!externalSocket || !enabled) return
    // Re-attach every time the socket instance changes (null → real socket).
    // Also re-announce on every attach so the proctor/candidate peer map is
    // always up-to-date even if this effect re-runs after a reconnect.
    externalSocket.on('peer.joined', handlePeerJoined)
    externalSocket.on('webrtc.offer', handleOffer)
    externalSocket.on('webrtc.answer', handleAnswer)
    externalSocket.on('webrtc.ice', handleIce)
    externalSocket.on('peer.left', handlePeerLeft)

    // If socket is already connected (common when this effect runs after
    // the socket was set up), announce immediately so the remote peer
    // receives peer.joined and initiates the WebRTC offer.
    if (externalSocket.connected && sessionId) {
      mySocketIdRef.current = externalSocket.id
      externalSocket.emit('peer.announce', {
        sessionId, role, socketId: externalSocket.id,
        candidateId: candidateIdRef.current,
      })
      setConnectionState(ConnectionState.Connected)
    }

    return () => {
      externalSocket.off('peer.joined', handlePeerJoined)
      externalSocket.off('webrtc.offer', handleOffer)
      externalSocket.off('webrtc.answer', handleAnswer)
      externalSocket.off('webrtc.ice', handleIce)
      externalSocket.off('peer.left', handlePeerLeft)
    }
  }, [externalSocket, enabled, handlePeerJoined, handleOffer, handleAnswer, handleIce, handlePeerLeft, sessionId, role])

  // ── Main effect: get camera, announce presence ────────────────────────────
  useEffect(() => {
    if (!enabled) return
    // PROCTOR now authenticates via the httpOnly access_token cookie
    // (PORTAL_GAPS.md C1) — jwtToken is optional here. The identity
    // fetch below uses credentials:'include' so the browser sends the
    // cookie automatically. Callers can still pass jwtToken for the
    // legacy Bearer-header path; missing it must not gate camera
    // acquisition.
    if (role === 'PROCTOR' && !sessionId) return
    if (role === 'CANDIDATE' && !magicToken) return

    let cancelled = false
    setConnectionState(ConnectionState.Connecting)

    // Kick off the Cloudflare TURN fetch in parallel with the identity +
    // camera acquisition below. By the time the first peer announces and
    // we create a PeerConnection, the merged ICE list is usually ready;
    // if it isn't, we still have the BASE_ICE_SERVERS list to fall back
    // on so nothing waits.
    fetchCloudflareIce().then((cf) => {
      if (cancelled || cf.length === 0) return
      iceServersRef.current = [...BASE_ICE_SERVERS, ...cf]
    })

    ;(async () => {
      try {
        // 1) Resolve identity
        //
        // Auth now rides the httpOnly `access_token` cookie for proctors
        // (PORTAL_GAPS.md C1). `credentials: 'include'` makes the browser
        // send it on this cross-cookie-scope fetch. jwtToken remains
        // supported as a fallback for any consumer that still passes it.
        const tokenUrl = role === 'PROCTOR'
          ? `${API_URL}/jitsi/proctor-token?sessionId=${sessionId}`
          : `${API_URL}/jitsi/candidate-token?magicToken=${magicToken}${candidateId ? `&candidateId=${candidateId}` : ''}`
        const headers: Record<string, string> = {}
        if (role === 'PROCTOR' && jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`

        let myIdentity = role === 'PROCTOR' ? `proctor-${sessionId}` : `candidate-unknown`
        try {
          const res = await fetch(tokenUrl, {
            headers,
            credentials: role === 'PROCTOR' ? 'include' : 'same-origin',
          })
          if (res.ok) { const d = await res.json(); myIdentity = d.identity || myIdentity }
        } catch {}
        if (cancelled) return
        myIdentityRef.current = myIdentity

        // 2) Get camera/mic FIRST.
        //
        // Video: request 1080p ideal with 720p min — browser/driver picks the
        // closest available; on a 720p webcam it negotiates down gracefully.
        // 30fps gives smooth motion for both interview talking-head and exam
        // monitoring without being heavy on CPU.
        //
        // Audio: echo cancellation + noise suppression + auto gain are the
        // three flags every WebRTC voice call wants on. 48kHz mono sample
        // rate matches Opus's preferred config — better speech clarity than
        // the default 44.1kHz fallback.
        if (publishCamera || publishMic) {
          // IDEAL hints only — no `min` constraints. min-constraints throw
          // OverconstrainedError on cameras that can't deliver them (older
          // webcams, integrated laptop cams, many phones), which falls
          // through to a video-only fallback that loses audio. Result:
          // candidate connects but the proctor sees no video / no audio
          // because the candidate's offer ends up with no local tracks at
          // all. With `ideal` only, the browser picks the closest mode it
          // can deliver and getUserMedia returns successfully on every
          // sane device.
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: publishCamera ? {
                width:  { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 },
                facingMode: 'user',
              } : false,
              audio: publishMic ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              } : false,
            })
            if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
            localStreamRef.current = stream
            setLocalCameraStream(stream)
          } catch (e: any) {
            // Fallback: try plain video + audio at default constraints so
            // we never silently drop audio. Only if THIS also fails (truly
            // no camera or permission denied), surface the error.
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                video: publishCamera || false,
                audio: publishMic ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
              })
              if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
              localStreamRef.current = stream
              setLocalCameraStream(stream)
            } catch {
              setError(`Camera denied: ${e.message}`)
            }
          }
        }
        if (cancelled) return

        // Re-announce AFTER camera is ready so any peer.joined that already
        // fired (before tracks were available) gets re-triggered. This fixes
        // the race where the candidate receives peer.joined, calls
        // initiateOffer, createPeerConn finds localStreamRef.current=null and
        // adds no tracks → offer has no video → remote sees black/nothing.
        const sock = externalSocket || ownSocketRef.current
        if (sock?.connected && sessionId) {
          sock.emit('peer.announce', {
            sessionId, role, socketId: sock.id,
            candidateId: candidateIdRef.current,
          })
        }

        // 3) If no external socket, create our own
        if (!externalSocket) {
          const ioFn = await getIo()
          if (cancelled) return
          const sock = ioFn(WS_URL, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
            reconnection: true,
          })
          ownSocketRef.current = sock

          sock.on('connect', () => {
            if (cancelled) return
            mySocketIdRef.current = sock.id
            // Read candidateId from the ref so a reconnect (or a connect
            // that happens AFTER OTP resolved candidateId) carries the
            // current id, not the undefined value captured at mount.
            const cid = candidateIdRef.current
            sock.emit('join_session', { sessionId, role, userId: myIdentity, candidateId: cid })
            sock.emit('peer.announce', { sessionId, role, socketId: sock.id, candidateId: cid })
            setConnectionState(ConnectionState.Connected)
          })
          sock.on('peer.joined', handlePeerJoined)
          sock.on('webrtc.offer', handleOffer)
          sock.on('webrtc.answer', handleAnswer)
          sock.on('webrtc.ice', handleIce)
          sock.on('peer.left', handlePeerLeft)
          sock.on('disconnect', () => setConnectionState(ConnectionState.Disconnected))
        } else {
          // External socket already connected — store its ID and announce.
          // Reads candidateId from the ref so it's always current even when
          // 'connect' fires AFTER candidateId was resolved post-OTP.
          const announceOnSocket = () => {
            if (cancelled) return
            mySocketIdRef.current = externalSocket.id
            // join_session puts the socket into the session room so
            // peer.left broadcasts on disconnect reach the right clients.
            externalSocket.emit('join_session', {
              sessionId, role, userId: myIdentityRef.current,
              candidateId: candidateIdRef.current,
            })
            externalSocket.emit('peer.announce', {
              sessionId, role, socketId: externalSocket.id,
              candidateId: candidateIdRef.current,
            })
            setConnectionState(ConnectionState.Connected)
          }
          if (externalSocket.connected) {
            announceOnSocket()
          }
          // Always attach a (persistent) 'connect' listener — covers the
          // initial connect AND any reconnects. The previous .once() lost
          // the announce on transient WS drops.
          externalSocket.on('connect', announceOnSocket)
        }

        if (publishScreen) await startScreenShare()

      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'WebRTC failed')
          setConnectionState(ConnectionState.Disconnected)
        }
      }
    })()

    return () => {
      cancelled = true
      peerConnsRef.current.forEach(c => {
        try { c.pc.close() } catch {}
        try { c.localVideoClone?.stop() } catch {}
        try { c.localAudioClone?.stop() } catch {}
      })
      peerConnsRef.current.clear()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
      screenStreamRef.current = null
      if (ownSocketRef.current) {
        ownSocketRef.current.emit('leave_session', { sessionId })
        ownSocketRef.current.disconnect()
        ownSocketRef.current = null
      }
      setPeers(new Map())
      setLocalCameraStream(null)
      setLocalScreenStream(null)
      setConnectionState(ConnectionState.Disconnected)
    }
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

export { useJitsi as useLivekit }
