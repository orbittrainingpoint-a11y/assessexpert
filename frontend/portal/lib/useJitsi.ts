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
const TURN_SECRET = process.env.NEXT_PUBLIC_TURN_SECRET || ''
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(TURN_SECRET ? [{
    urls: [
      `turn:${(process.env.NEXT_PUBLIC_WS_URL || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '')}:3478?transport=udp`,
      `turn:${(process.env.NEXT_PUBLIC_WS_URL || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '')}:3478?transport=tcp`,
      `turns:${(process.env.NEXT_PUBLIC_WS_URL || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '')}:5349?transport=tcp`,
    ],
    username: 'assessexpert',
    credential: TURN_SECRET,
  }] : []),
]

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
      next.set(conn.identity, {
        identity: conn.identity,
        name: conn.identity,
        role: parseRole(conn.identity),
        candidateId: parseCandidateId(conn.identity),
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

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
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
        try { pc.addTrack(v, localStreamRef.current) } catch {}
      }
      if (audioSrc) {
        const a = audioSrc.clone()
        conn.localAudioClone = a
        try { pc.addTrack(a, localStreamRef.current) } catch {}
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
      const stream = e.streams[0] || new MediaStream([e.track])
      if (e.track.kind === 'video') {
        // First video = camera, second video = screen
        if (!conn.cameraStream) {
          conn.cameraStream = stream
        } else {
          conn.screenStream = stream
        }
      } else if (e.track.kind === 'audio') {
        if (conn.cameraStream) {
          // Attach audio to camera stream
          try { conn.cameraStream.addTrack(e.track) } catch {}
        } else {
          conn.cameraStream = stream
        }
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

  // Proctor 1-to-1 routing: when the proctor picks an active candidate,
  // mute the outbound audio/video to every OTHER candidate. Inactive
  // candidates see frozen video + silence until the proctor switches.
  // No selection (undefined) → broadcast to all (default during MCQ).
  useEffect(() => {
    if (role !== 'PROCTOR') return
    activeTargetRef.current = activeTargetSocketId
    peerConnsRef.current.forEach((conn, peerSocketId) => {
      const isActive = !activeTargetSocketId || peerSocketId === activeTargetSocketId
      if (conn.localVideoClone) conn.localVideoClone.enabled = isActive
      if (conn.localAudioClone) conn.localAudioClone.enabled = isActive
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
    const remoteIdentity = data.peerRole === 'PROCTOR'
      ? `proctor-${data.peerId}`
      : `candidate-${data.candidateId || data.peerId}`
    setTimeout(() => initiateOffer(data.peerId, remoteIdentity), 500)
  }, [getMySocketId, role, initiateOffer])

  const handleOffer = useCallback(async (data: { fromId: string; offer: RTCSessionDescriptionInit }) => {
    // Ignore offers from ourselves
    if (data.fromId === getMySocketId()) return
    let conn = peerConnsRef.current.get(data.fromId)
    if (!conn) {
      const remoteIdentity = role === 'PROCTOR' ? `candidate-${data.fromId}` : `proctor-${data.fromId}`
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
    try { await conn.pc.setRemoteDescription(new RTCSessionDescription(data.answer)) } catch {}
  }, [])

  const handleIce = useCallback(async (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
    const conn = peerConnsRef.current.get(data.fromId)
    if (!conn) return
    try { await conn.pc.addIceCandidate(new RTCIceCandidate(data.candidate)) } catch {}
  }, [])

  const handlePeerLeft = useCallback((data: { peerId: string }) => {
    const conn = peerConnsRef.current.get(data.peerId)
    if (conn) {
      try { conn.pc.close() } catch {}
      peerConnsRef.current.delete(data.peerId)
      rebuildPeers()
    }
  }, [rebuildPeers])

  // ── Attach signalling handlers to external socket when it becomes available
  useEffect(() => {
    if (!externalSocket || !enabled) return
    externalSocket.on('peer.joined', handlePeerJoined)
    externalSocket.on('webrtc.offer', handleOffer)
    externalSocket.on('webrtc.answer', handleAnswer)
    externalSocket.on('webrtc.ice', handleIce)
    externalSocket.on('peer.left', handlePeerLeft)
    return () => {
      externalSocket.off('peer.joined', handlePeerJoined)
      externalSocket.off('webrtc.offer', handleOffer)
      externalSocket.off('webrtc.answer', handleAnswer)
      externalSocket.off('webrtc.ice', handleIce)
      externalSocket.off('peer.left', handlePeerLeft)
    }
  }, [externalSocket, enabled, handlePeerJoined, handleOffer, handleAnswer, handleIce, handlePeerLeft])

  // ── Main effect: get camera, announce presence ────────────────────────────
  useEffect(() => {
    if (!enabled) return
    if (role === 'PROCTOR' && (!sessionId || !jwtToken)) return
    if (role === 'CANDIDATE' && !magicToken) return

    let cancelled = false
    setConnectionState(ConnectionState.Connecting)

    ;(async () => {
      try {
        // 1) Resolve identity
        const tokenUrl = role === 'PROCTOR'
          ? `${API_URL}/jitsi/proctor-token?sessionId=${sessionId}`
          : `${API_URL}/jitsi/candidate-token?magicToken=${magicToken}${candidateId ? `&candidateId=${candidateId}` : ''}`
        const headers: Record<string, string> = {}
        if (role === 'PROCTOR' && jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`

        let myIdentity = role === 'PROCTOR' ? `proctor-${sessionId}` : `candidate-unknown`
        try {
          const res = await fetch(tokenUrl, { headers })
          if (res.ok) { const d = await res.json(); myIdentity = d.identity || myIdentity }
        } catch {}
        if (cancelled) return
        myIdentityRef.current = myIdentity

        // 2) Get camera/mic FIRST
        if (publishCamera || publishMic) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: publishCamera ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
              audio: publishMic ? { echoCancellation: true, noiseSuppression: true } : false,
            })
            if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
            localStreamRef.current = stream
            setLocalCameraStream(stream)
          } catch (e: any) {
            // Fallback: video only
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
              if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
              localStreamRef.current = stream
              setLocalCameraStream(stream)
            } catch {
              setError(`Camera denied: ${e.message}`)
            }
          }
        }
        if (cancelled) return

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
            sock.emit('join_session', { sessionId, role, userId: myIdentity, candidateId })
            // Critical for multi-candidate slots: include candidateId so the
            // proctor can map this peer to a specific SessionCandidate row.
            // Without it, multiple candidates collide on `candidate-${socketId}`
            // and the proctor's stream lookup by database id fails.
            sock.emit('peer.announce', { sessionId, role, socketId: sock.id, candidateId })
            setConnectionState(ConnectionState.Connected)
          })
          sock.on('peer.joined', handlePeerJoined)
          sock.on('webrtc.offer', handleOffer)
          sock.on('webrtc.answer', handleAnswer)
          sock.on('webrtc.ice', handleIce)
          sock.on('peer.left', handlePeerLeft)
          sock.on('disconnect', () => setConnectionState(ConnectionState.Disconnected))
        } else {
          // External socket already connected — store its ID and announce
          const announceOnSocket = () => {
            if (cancelled) return
            mySocketIdRef.current = externalSocket.id
            externalSocket.emit('peer.announce', { sessionId, role, socketId: externalSocket.id, candidateId })
            setConnectionState(ConnectionState.Connected)
          }
          if (externalSocket.connected) {
            announceOnSocket()
          } else {
            externalSocket.once('connect', announceOnSocket)
          }
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
