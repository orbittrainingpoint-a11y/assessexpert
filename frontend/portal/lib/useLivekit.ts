'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  RemoteTrackPublication,
} from 'livekit-client'

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

interface UseLivekitOptions {
  enabled: boolean
  role: 'PROCTOR' | 'CANDIDATE'
  sessionId?: string // for proctor
  magicToken?: string // for candidate
  jwtToken?: string // for proctor authentication
  publishCamera?: boolean
  publishMic?: boolean
  publishScreen?: boolean
}

/**
 * Hook that wraps a LiveKit Room with our own simpler peer/track API.
 * Replaces the previous useWebRTC P2P hook with a proper SFU.
 */
export function useLivekit({
  enabled,
  role,
  sessionId,
  magicToken,
  jwtToken,
  publishCamera = true,
  publishMic = true,
  publishScreen = false,
}: UseLivekitOptions) {
  const roomRef = useRef<Room | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null)
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [screenShareActive, setScreenShareActive] = useState(false)

  // Identify the peer based on identity string conventions
  const parseRole = (identity: string): 'PROCTOR' | 'CANDIDATE' | 'OBSERVER' => {
    if (identity.startsWith('proctor-')) return 'PROCTOR'
    if (identity.startsWith('candidate-')) return 'CANDIDATE'
    return 'OBSERVER'
  }
  const parseCandidateId = (identity: string): string | undefined =>
    identity.startsWith('candidate-') ? identity.replace('candidate-', '') : undefined

  // Rebuild a single peer's tracks/streams from a participant's current publications
  const buildPeer = (p: RemoteParticipant): RemotePeer => {
    let cameraTrack: MediaStreamTrack | null = null
    let micTrack: MediaStreamTrack | null = null
    let screenTrack: MediaStreamTrack | null = null
    p.trackPublications.forEach((pub) => {
      const t = (pub as RemoteTrackPublication).track
      if (!t || !t.mediaStreamTrack) return
      if (pub.source === Track.Source.Camera) cameraTrack = t.mediaStreamTrack
      else if (pub.source === Track.Source.Microphone) micTrack = t.mediaStreamTrack
      else if (pub.source === Track.Source.ScreenShare) screenTrack = t.mediaStreamTrack
    })
    return {
      identity: p.identity,
      name: p.name || p.identity,
      role: parseRole(p.identity),
      candidateId: parseCandidateId(p.identity),
      cameraTrack,
      micTrack,
      screenTrack,
      cameraStream: cameraTrack
        ? new MediaStream(micTrack ? [cameraTrack, micTrack] : [cameraTrack])
        : null,
      screenStream: screenTrack ? new MediaStream([screenTrack]) : null,
    }
  }

  const refreshPeers = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const next = new Map<string, RemotePeer>()
    room.remoteParticipants.forEach((p) => {
      next.set(p.identity, buildPeer(p))
    })
    setPeers(next)
  }, [])

  // Toggle screen share publishing
  const startScreenShare = useCallback(async () => {
    const room = roomRef.current
    if (!room?.localParticipant) return false
    try {
      await room.localParticipant.setScreenShareEnabled(true)
      const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
      const track = pub?.track?.mediaStreamTrack
      if (track) {
        setLocalScreenStream(new MediaStream([track]))
        setScreenShareActive(true)
        // Auto-detect when user stops sharing via browser UI
        track.addEventListener('ended', () => {
          setLocalScreenStream(null)
          setScreenShareActive(false)
        })
      }
      return true
    } catch (e: any) {
      setError(`Screen share failed: ${e.message}`)
      return false
    }
  }, [])

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current
    if (!room?.localParticipant) return
    await room.localParticipant.setScreenShareEnabled(false)
    setLocalScreenStream(null)
    setScreenShareActive(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (role === 'PROCTOR' && (!sessionId || !jwtToken)) return
    if (role === 'CANDIDATE' && !magicToken) return

    let cancelled = false
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        videoSimulcastLayers: [],
      },
    })
    roomRef.current = room

    const onTrackSubscribed = () => refreshPeers()
    const onTrackUnsubscribed = () => refreshPeers()
    const onParticipantConnected = () => refreshPeers()
    const onParticipantDisconnected = () => refreshPeers()
    const onConnectionStateChanged = (state: ConnectionState) => setConnectionState(state)
    const onLocalTrackPublished = () => {
      // Update local streams when we publish a track
      const lp = room.localParticipant
      const camPub = lp.getTrackPublication(Track.Source.Camera)
      const micPub = lp.getTrackPublication(Track.Source.Microphone)
      const camTrack = camPub?.track?.mediaStreamTrack
      const micTrack = micPub?.track?.mediaStreamTrack
      if (camTrack) {
        setLocalCameraStream(new MediaStream(micTrack ? [camTrack, micTrack] : [camTrack]))
      }
    }

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished)

    const connect = async () => {
      try {
        // Fetch token from backend
        const tokenUrl = role === 'PROCTOR'
          ? `${API_URL}/livekit/proctor-token?sessionId=${sessionId}`
          : `${API_URL}/livekit/candidate-token?magicToken=${magicToken}`
        const headers: Record<string, string> = {}
        if (role === 'PROCTOR' && jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`

        const res = await fetch(tokenUrl, { headers })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`Token fetch failed: ${res.status} ${txt}`)
        }
        const { token, wsUrl } = await res.json()
        if (cancelled) return

        await room.connect(wsUrl, token, { autoSubscribe: true })
        if (cancelled) {
          await room.disconnect()
          return
        }

        // Publish camera & mic
        if (publishCamera) {
          await room.localParticipant.setCameraEnabled(true)
        }
        if (publishMic) {
          await room.localParticipant.setMicrophoneEnabled(true)
        }
        if (publishScreen) {
          await room.localParticipant.setScreenShareEnabled(true)
        }

        refreshPeers()
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'LiveKit connection failed')
      }
    }
    connect()

    return () => {
      cancelled = true
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished)
      room.disconnect().catch(() => {})
      roomRef.current = null
      setPeers(new Map())
      setLocalCameraStream(null)
      setLocalScreenStream(null)
    }
  }, [enabled, role, sessionId, magicToken, jwtToken, publishCamera, publishMic, publishScreen, refreshPeers])

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
