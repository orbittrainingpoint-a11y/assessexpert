'use client'
import { useEffect, useRef, useCallback, useState } from 'react'

// ICE servers with TURN for NAT traversal (works behind firewalls/routers)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Free TURN servers — replace with your own for production
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

interface UseWebRTCOptions {
  sessionId: string
  role: 'PROCTOR' | 'CANDIDATE'
  localStream: MediaStream | null
  socket: any // socket.io instance from useSessionWebSocket
  enabled?: boolean
  candidateId?: string // For CANDIDATE role to identify themselves
  activeCandidateId?: string // For PROCTOR role to control audio routing
}

export function useWebRTC({ sessionId, role, localStream, socket, enabled = true, candidateId, activeCandidateId }: UseWebRTCOptions) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [proctorActive, setProctorActive] = useState(false)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const activeCandidateIdRef = useRef<string | undefined>(activeCandidateId)

  // Keep localStreamRef in sync and re-add tracks to existing peers when stream changes
  useEffect(() => {
    localStreamRef.current = localStream
    // Re-add tracks to all existing peer connections when stream becomes available
    if (localStream) {
      peersRef.current.forEach(peer => {
        const senders = peer.getSenders()
        localStream.getTracks().forEach(track => {
          const existing = senders.find(s => s.track?.kind === track.kind)
          if (existing) {
            existing.replaceTrack(track).catch(() => {})
          } else {
            peer.addTrack(track, localStream)
          }
        })
      })
    }
  }, [localStream])

  // Update activeCandidateId ref
  useEffect(() => {
    activeCandidateIdRef.current = activeCandidateId
  }, [activeCandidateId])

  const createPeer = useCallback((peerId: string, initiator: boolean): RTCPeerConnection => {
    // Close existing peer if any
    const existing = peersRef.current.get(peerId)
    if (existing) { existing.close(); peersRef.current.delete(peerId) }

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add local tracks
    const stream = localStreamRef.current
    if (stream) {
      stream.getTracks().forEach(track => peer.addTrack(track, stream))
    }

    // Receive remote stream
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (remoteStream) {
        setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream))
        // If candidate receives proctor stream, mark proctor as active
        if (role === 'CANDIDATE') {
          setProctorActive(true)
        }
      }
    }

    // Send ICE candidates via socket
    peer.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit('webrtc.ice', {
          sessionId,
          targetId: peerId,
          candidate: event.candidate.toJSON(),
        })
      }
    }

    peer.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
        setRemoteStreams(prev => { const m = new Map(prev); m.delete(peerId); return m })
        peersRef.current.delete(peerId)
        if (role === 'CANDIDATE') setProctorActive(false)
      }
    }

    // Initiator creates offer — request audio + video
    if (initiator) {
      peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
          if (peer.localDescription && socket?.connected) {
            socket.emit('webrtc.offer', {
              sessionId,
              targetId: peerId,
              offer: peer.localDescription,
            })
          }
        })
        .catch(() => {})
    }

    peersRef.current.set(peerId, peer)
    return peer
  }, [sessionId, socket])

  useEffect(() => {
    if (!enabled || !socket || typeof window === 'undefined') return

    const handleOffer = async ({ fromId, offer }: { fromId: string; offer: RTCSessionDescriptionInit }) => {
      const peer = createPeer(fromId, false)
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        socket.emit('webrtc.answer', { sessionId, targetId: fromId, answer: peer.localDescription })
      } catch {}
    }

    const handleAnswer = async ({ fromId, answer }: { fromId: string; answer: RTCSessionDescriptionInit }) => {
      const peer = peersRef.current.get(fromId)
      if (peer && peer.signalingState !== 'stable') {
        try { await peer.setRemoteDescription(new RTCSessionDescription(answer)) } catch {}
      }
    }

    const handleIce = async ({ fromId, candidate }: { fromId: string; candidate: RTCIceCandidateInit }) => {
      const peer = peersRef.current.get(fromId)
      if (peer) {
        try { await peer.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
      }
    }

    // When a peer joins the session room — proctor always initiates the connection
    // so we avoid both sides creating offers simultaneously (glare)
    const handlePeerJoined = ({ peerId, peerRole }: { peerId: string; peerRole: string }) => {
      // Skip if already connected to this peer
      if (peersRef.current.has(peerId)) return
      if (role === 'PROCTOR' && peerRole === 'CANDIDATE') {
        createPeer(peerId, true)
      }
      // Candidate doesn't initiate; it waits for the proctor's offer
    }

    // Clean up peer when it leaves the session
    const handlePeerLeft = ({ peerId }: { peerId: string }) => {
      const peer = peersRef.current.get(peerId)
      if (peer) {
        peer.close()
        peersRef.current.delete(peerId)
      }
      setRemoteStreams(prev => { const m = new Map(prev); m.delete(peerId); return m })
      if (role === 'CANDIDATE') setProctorActive(false)
    }

    // CANDIDATE: Listen for proctor activation/deactivation
    const handleProctorAudioActive = () => {
      setProctorActive(true)
    }

    const handleProctorAudioInactive = () => {
      setProctorActive(false)
    }

    socket.on('webrtc.offer', handleOffer)
    socket.on('webrtc.answer', handleAnswer)
    socket.on('webrtc.ice', handleIce)
    socket.on('peer.joined', handlePeerJoined)
    socket.on('peer.left', handlePeerLeft)

    if (role === 'CANDIDATE') {
      socket.on('proctor.audio_active', handleProctorAudioActive)
      socket.on('proctor.audio_inactive', handleProctorAudioInactive)
      // Announce with candidateId
      socket.emit('peer.announce', { sessionId, role, socketId: socket.id, candidateId })
    } else {
      socket.emit('peer.announce', { sessionId, role, socketId: socket.id })
    }

    return () => {
      socket.off('webrtc.offer', handleOffer)
      socket.off('webrtc.answer', handleAnswer)
      socket.off('webrtc.ice', handleIce)
      socket.off('peer.joined', handlePeerJoined)
      socket.off('peer.left', handlePeerLeft)
      if (role === 'CANDIDATE') {
        socket.off('proctor.audio_active', handleProctorAudioActive)
        socket.off('proctor.audio_inactive', handleProctorAudioInactive)
      }
      peersRef.current.forEach(peer => peer.close())
      peersRef.current.clear()
      setRemoteStreams(new Map())
    }
  }, [enabled, socket, sessionId, role, createPeer, candidateId])

  return { remoteStreams, proctorActive }
}
