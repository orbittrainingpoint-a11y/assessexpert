import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track connected clients: socketId -> { sessionId, role, userId, candidateId }
  private clients = new Map<string, { sessionId?: string; role?: string; userId?: string; candidateId?: string }>();
  
  // Track active proctor-candidate audio connections: sessionId -> { proctorSocketId, activeCandidateSocketId }
  private activeAudioConnections = new Map<string, { proctorSocketId: string; activeCandidateSocketId: string | null }>();

  handleConnection(client: Socket) {
    this.clients.set(client.id, {});
  }

  handleDisconnect(client: Socket) {
    const clientData = this.clients.get(client.id);
    if (clientData?.sessionId && clientData?.role === 'PROCTOR') {
      this.activeAudioConnections.delete(clientData.sessionId);
    }
    this.clients.delete(client.id);
  }

  // ── Client joins a session room ──────────────────────────────────────────
  @SubscribeMessage('join_session')
  handleJoinSession(
    @MessageBody() data: { sessionId: string; role: string; userId?: string; candidateId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`session:${data.sessionId}`)
    client.join(`peer:${client.id}`) // Personal room for WebRTC signalling;
    this.clients.set(client.id, {
      sessionId: data.sessionId,
      role: data.role,
      userId: data.userId,
      candidateId: data.candidateId,
    });

    // Track proctor socket for audio routing
    if (data.role === 'PROCTOR') {
      this.activeAudioConnections.set(data.sessionId, {
        proctorSocketId: client.id,
        activeCandidateSocketId: null,
      });
    }

    // Notify proctor that candidate joined (if candidate)
    if (data.role === 'CANDIDATE') {
      this.server.to(`session:${data.sessionId}`).emit('candidate.joined', {
        sessionId: data.sessionId,
        candidateId: data.candidateId,
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });
    }

    return { joined: true, room: `session:${data.sessionId}` };
  }

  // ── Candidate leaves session room ────────────────────────────────────────
  @SubscribeMessage('leave_session')
  handleLeaveSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`session:${data.sessionId}`);
    return { left: true };
  }

  // ── Proctor sends checklist update to candidate ──────────────────────────
  @SubscribeMessage('checklist.update')
  handleChecklistUpdate(
    @MessageBody() data: { sessionId: string; itemKey: string; status: string; instruction?: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('checklist.update', data);
    return { sent: true };
  }

  // ── Proctor sends message to candidate ──────────────────────────────────
  @SubscribeMessage('message.send')
  handleMessageSend(
    @MessageBody() data: { sessionId: string; message: string; targetRole?: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('proctor.message', {
      message: data.message,
      timestamp: new Date().toISOString(),
    });
    return { sent: true };
  }

  // ── AI flag raised ───────────────────────────────────────────────────────
  @SubscribeMessage('ai.flag')
  handleAiFlag(
    @MessageBody() data: { sessionId: string; eventType: string; severity: string; candidateName?: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('ai.flag', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return { sent: true };
  }

  // ── Proctor pauses/resumes session ───────────────────────────────────────
  @SubscribeMessage('session.pause')
  handleSessionPause(
    @MessageBody() data: { sessionId: string; paused: boolean },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('session.pause', data);
    return { sent: true };
  }

  // ── Candidate camera/screen status update ────────────────────────────────
  @SubscribeMessage('candidate.status')
  handleCandidateStatus(
    @MessageBody() data: { sessionId: string; faceStatus: string; screenStatus: string; questionProgress?: number },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('candidate.status', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return { sent: true };
  }

  // ── Session phase change (MCQ started, practical started, etc.) ──────────
  @SubscribeMessage('session.phase')
  handleSessionPhase(
    @MessageBody() data: { sessionId: string; phase: string; practicalTask?: any },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('session.phase', data);
    return { sent: true };
  }

  // ── Peer announces presence (triggers WebRTC initiation) ────────────────────────────────────────────────────
  @SubscribeMessage('peer.announce')
  handlePeerAnnounce(
    @MessageBody() data: { sessionId: string; role: string; socketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Notify all others in the session room that a new peer has joined
    client.to(`session:${data.sessionId}`).emit('peer.joined', {
      peerId: client.id,
      peerRole: data.role,
    })
    return { announced: true }
  }

  // ── WebRTC Signalling ────────────────────────────────────────────────────
  @SubscribeMessage('webrtc.offer')
  handleWebRtcOffer(
    @MessageBody() data: { sessionId: string; targetId: string; offer: any },
    @ConnectedSocket() client: Socket,
  ) {
    // Forward offer to target peer
    this.server.to(`peer:${data.targetId}`).emit('webrtc.offer', {
      fromId: client.id,
      offer: data.offer,
    })
    return { forwarded: true }
  }

  @SubscribeMessage('webrtc.answer')
  handleWebRtcAnswer(
    @MessageBody() data: { sessionId: string; targetId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(`peer:${data.targetId}`).emit('webrtc.answer', {
      fromId: client.id,
      answer: data.answer,
    })
    return { forwarded: true }
  }

  @SubscribeMessage('webrtc.ice')
  handleWebRtcIce(
    @MessageBody() data: { sessionId: string; targetId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(`peer:${data.targetId}`).emit('webrtc.ice', {
      fromId: client.id,
      candidate: data.candidate,
    })
    return { forwarded: true }
  }

  // ── Proctor activates audio with specific candidate ────────────────────────────────
  @SubscribeMessage('proctor.activate_candidate')
  handleProctorActivateCandidate(
    @MessageBody() data: { sessionId: string; candidateSocketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const connection = this.activeAudioConnections.get(data.sessionId);
    if (connection) {
      // Notify previous candidate to mute audio
      if (connection.activeCandidateSocketId) {
        this.server.to(`peer:${connection.activeCandidateSocketId}`).emit('proctor.audio_inactive', {
          sessionId: data.sessionId,
        });
      }
      
      // Update active candidate
      connection.activeCandidateSocketId = data.candidateSocketId;
      
      // Notify new candidate to unmute audio
      this.server.to(`peer:${data.candidateSocketId}`).emit('proctor.audio_active', {
        sessionId: data.sessionId,
        proctorSocketId: client.id,
      });
    }
    
    return { activated: true, candidateSocketId: data.candidateSocketId };
  }

  // ── Proctor deactivates audio with candidate ────────────────────────────────────
  @SubscribeMessage('proctor.deactivate_candidate')
  handleProctorDeactivateCandidate(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const connection = this.activeAudioConnections.get(data.sessionId);
    if (connection && connection.activeCandidateSocketId) {
      // Notify candidate to mute audio
      this.server.to(`peer:${connection.activeCandidateSocketId}`).emit('proctor.audio_inactive', {
        sessionId: data.sessionId,
      });
      connection.activeCandidateSocketId = null;
    }
    
    return { deactivated: true };
  }

  // ── Server-side emit helpers (called from services) ──────────────────────
  emitToSession(sessionId: string, event: string, data: any) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }

  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }
}
