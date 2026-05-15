'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Pure WebRTC hook — no Jitsi, no external media server required.
 *
 * Signalling uses the existing Socket.IO gateway:
 *   peer.announce  → tells others you joined
 *   peer.joined    → someone else joined, initiate offer
 *   webrtc.offer   → forward SDP offer
 *   webrtc.answer  → forward SDP answer
 *   webrtc.ice     → forward ICE candidate
 *   peer.left      → clean up peer connection
 *
 * Exported shape is identical to the old useLivekit/useJitsi so all
 * consumer files (proctor session page, exam page) work unchanged.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
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
  publishCamera?: boolean
  publishMic?: boolean
  publishScreen?: boolean
}

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
}

// One RTCPeerConnection per remote peer, keyed by their socket id
interface PeerConn {
  pc: RTCPeerConnection
  socketId: string
  identity: string   // 'candidate-xxx' or 'proctor-xxx'
  cameraStream: MediaStream | null
  screenStream: MediaStream | null
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
  publishCamera = true,
  publishMic = true,
  publishScreen = false,
}: UseJitsiOptions) {
  const socketRef = useRef<any>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnsRef = useRef<Map<string, PeerConn>>(new Map())
  const myIdentityRef = useRef<string>('')
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

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
  const parseCandidateId = (id: string) =>
    id.startsWith('candidate-') ? id.replace('candidate-', '') : undefined

  // Rebuild the public peers map from peerConnsRef
  const rebuildPeers = useCallback(() => {
    const next = new Map<string, RemotePeer>()
    peerConnsRef.current.forEach((conn) => {
      const camTracks = conn.cameraStream?.getVideoTracks() || []
      const micTracks = conn.cameraStream?.getAudioTracks() || []
      const scrTracks = conn.screenStream?.getVideoTracks() || []
      next.set(conn.identity, {
        identity: conn.identity,
        name: conn.identity,
        role: parseRole(conn.identity),
        candidateId: parseCandidateId(conn.identity),
        cameraTrack: camTracks[0] || null,
        micTrack: micTracks[0] || null,
        screenTrack: scrTracks[0] || null,
        cameraStream: conn.cameraStream,
        screenStream: conn.screenStream,
      })
    })
    setPeers(next)
  }, [])

  // Create a new RTCPeerConnection for a remote peer
  const createPeerConn = useCallback((remoteSocketId: string, remoteIdentity: string): PeerConn => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const conn: PeerConn = { pc, socketId: remoteSocketId, identity: remoteIdentity, cameraStream: null, screenStream: null }
    peerConnsRef.current.set(remoteSocketId, conn)

    // Add our local tracks to this connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!))
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => pc.addTrack(t, screenStreamRef.current!))
    }

    // ICE candidates → forward via socket
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit('webrtc.ice', {
          sessionId: sessionIdRef.current,
          targetId: remoteSocketId,
          candidate: e.candidate,
        })
      }
    }

    // Remote tracks arriving
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track])
      const isScreen = e.track.label?.toLowerCase().includes('screen') ||
        e.track.label?.toLowerCase().includes('display') ||
        (e.track.kind === 'video' && conn.cameraStream !== null)

      if (e.track.kind === 'video' && !isScreen && !conn.cameraStream) {
        conn.cameraStream = stream
      } else if (e.track.kind === 'audio' && conn.cameraStream) {
        // Add audio track to existing camera stream
        conn.cameraStream.addTrack(e.track)
      } else if (isScreen) {
        conn.screenStream = stream
      } else if (e.track.kind === 'video') {
        conn.cameraStream = stream
      }
      rebuildPeers()
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setConnectionState(ConnectionState.Connected)
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        peerConnsRef.current.delete(remoteSocketId)
        rebuildPeers()
      }
    }

    return conn
  }, [rebuildPeers])

  const removePeer = useCallback((socketId: string) => {
    const conn = peerConnsRef.current.get(socketId)
    if (conn) {
      conn.pc.close()
      peerConnsRef.current.delete(socketId)
      rebuildPeers()
    }
  }, [rebuildPeers])

  // Initiate offer to a remote peer (called when we learn about them)
  const initiateOffer = useCallback(async (remoteSocketId: string, remoteIdentity: string) => {
    const conn = createPeerConn(remoteSocketId, remoteIdentity)
    try {
      const offer = await conn.pc.createOffer()
      await conn.pc.setLocalDescription(offer)
      socketRef.current?.emit('webrtc.offer', {
        sessionId: sessionIdRef.current,
        targetId: remoteSocketId,
        offer,
      })
    } catch (e: any) {
      setError(`Offer failed: ${e.message}`)
    }
  }, [createPeerConn])

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      screenStreamRef.current = stream
      setLocalScreenStream(stream)
      setScreenShareActive(true)

      // Add screen track to all existing peer connections
      peerConnsRef.current.forEach(async (conn) => {
        stream.getTracks().forEach(t => conn.pc.addTrack(t, stream))
        // Renegotiate
        try {
          const offer = await conn.pc.createOffer()
          await conn.pc.setLocalDescription(offer)
          socketRef.current?.emit('webrtc.offer', {
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
  }, [])

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
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
        // 1) Resolve our identity from the backend token endpoint
        const tokenUrl = role === 'PROCTOR'
          ? `${API_URL}/jitsi/proctor-token?sessionId=${sessionId}`
          : `${API_URL}/jitsi/candidate-token?magicToken=${magicToken}`
        const headers: Record<string, string> = {}
        if (role === 'PROCTOR' && jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`

        let myIdentity = role === 'PROCTOR' ? `proctor-unknown` : `candidate-unknown`
        try {
          const res = await fetch(tokenUrl, { headers })
          if (res.ok) {
            const data = await res.json()
            myIdentity = data.identity || myIdentity
          }
        } catch {}
        if (cancelled) return
        myIdentityRef.current = myIdentity

        // 2) Acquire local camera + mic FIRST before connecting socket
        if (publishCamera || publishMic) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: publishCamera ? { width: 1280, height: 720 } : false,
              audio: publishMic,
            })
            localStreamRef.current = stream
            setLocalCameraStream(stream)
          } catch (e: any) {
            // Try video-only fallback
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: publishCamera, audio: false })
              localStreamRef.current = stream
              setLocalCameraStream(stream)
            } catch {
              setError(`Camera/mic access denied: ${e.message}`)
            }
          }
        }
        if (cancelled) return

        // 3) Connect to Socket.IO signalling server
        const ioFn = await getIo()
        if (cancelled) return

        const socket = ioFn(WS_URL, {
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        })
        socketRef.current = socket

        socket.on('connect', () => {
          if (cancelled) return
          // Join the session room
          socket.emit('join_session', {
            sessionId,
            role,
            userId: myIdentity,
          })
          // Announce ourselves so existing peers know to initiate offers to us
          socket.emit('peer.announce', {
            sessionId,
            role,
            socketId: socket.id,
            identity: myIdentity,
          })
          setConnectionState(ConnectionState.Connected)
        })

        socket.on('disconnect', () => {
          setConnectionState(ConnectionState.Disconnected)
        })

        // A new peer joined — WE initiate the offer to them
        // Small delay ensures both sides have their local stream ready
        socket.on('peer.joined', async (data: { peerId: string; peerRole: string; candidateId?: string }) => {
          if (cancelled || data.peerId === socket.id) return
          const remoteIdentity = data.peerRole === 'PROCTOR'
            ? `proctor-${data.peerId}`
            : `candidate-${data.candidateId || data.peerId}`
          // 300ms delay so both sides finish getUserMedia before negotiating
          setTimeout(() => initiateOffer(data.peerId, remoteIdentity), 300)
        })

        // Received an offer — create answer
        socket.on('webrtc.offer', async (data: { fromId: string; offer: RTCSessionDescriptionInit }) => {
          if (cancelled) return
          let conn = peerConnsRef.current.get(data.fromId)
          if (!conn) {
            // Determine remote identity from existing peers map or fallback
            const remoteIdentity = role === 'PROCTOR' ? `candidate-${data.fromId}` : `proctor-${data.fromId}`
            conn = createPeerConn(data.fromId, remoteIdentity)
          }
          try {
            await conn.pc.setRemoteDescription(new RTCSessionDescription(data.offer))
            const answer = await conn.pc.createAnswer()
            await conn.pc.setLocalDescription(answer)
            socket.emit('webrtc.answer', {
              sessionId,
              targetId: data.fromId,
              answer,
            })
          } catch (e: any) {
            setError(`Answer failed: ${e.message}`)
          }
        })

        // Received an answer
        socket.on('webrtc.answer', async (data: { fromId: string; answer: RTCSessionDescriptionInit }) => {
          if (cancelled) return
          const conn = peerConnsRef.current.get(data.fromId)
          if (!conn) return
          try {
            await conn.pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          } catch {}
        })

        // Received ICE candidate
        socket.on('webrtc.ice', async (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
          if (cancelled) return
          const conn = peerConnsRef.current.get(data.fromId)
          if (!conn) return
          try {
            await conn.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } catch {}
        })

        // Peer left
        socket.on('peer.left', (data: { peerId: string }) => {
          removePeer(data.peerId)
        })

        if (publishScreen) await startScreenShare()

      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'WebRTC connection failed')
          setConnectionState(ConnectionState.Disconnected)
        }
      }
    })()

    return () => {
      cancelled = true
      // Close all peer connections
      peerConnsRef.current.forEach(conn => conn.pc.close())
      peerConnsRef.current.clear()
      // Stop local tracks
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
      screenStreamRef.current = null
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.emit('leave_session', { sessionId })
        socketRef.current.disconnect()
        socketRef.current = null
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
