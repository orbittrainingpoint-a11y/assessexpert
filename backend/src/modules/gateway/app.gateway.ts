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
  
  // Track verified candidates per session: sessionId -> Set<candidateId>
  private verifiedCandidates = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.clients.set(client.id, {});
  }

  handleDisconnect(client: Socket) {
    const clientData = this.clients.get(client.id);
    if (clientData?.sessionId) {
      // Notify everyone in the session that this peer left, so WebRTC peers can clean up
      this.server.to(`session:${clientData.sessionId}`).emit('peer.left', {
        peerId: client.id,
        peerRole: clientData.role,
        candidateId: clientData.candidateId,
      });
      if (clientData.role === 'PROCTOR') {
        this.activeAudioConnections.delete(clientData.sessionId);
      }
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

  // ── AI multiple faces detected ───────────────────────────────────────────
  @SubscribeMessage('ai.multiple_faces')
  handleMultipleFaces(
    @MessageBody() data: { sessionId: string; faceCount: number; screenshotPath?: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('ai.multiple_faces', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return { sent: true };
  }

  // ── AI face absent detected ──────────────────────────────────────────────
  @SubscribeMessage('ai.face_absent')
  handleFaceAbsent(
    @MessageBody() data: { sessionId: string; message: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('ai.face_absent', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return { sent: true };
  }

  // ── AI looking away detected ──────────────────────────────────────────────
  @SubscribeMessage('ai.looking_away')
  handleLookingAway(
    @MessageBody() data: { sessionId: string; headAngle: any; message: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('ai.looking_away', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return { sent: true };
  }

  // ── AI hand near face detected ────────────────────────────────────────────
  @SubscribeMessage('ai.hand_near_face')
  handleHandNearFace(
    @MessageBody() data: { sessionId: string; handCount: number; message: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('ai.hand_near_face', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return { sent: true };
  }

  // ── AI gaze offscreen detected ────────────────────────────────────────────
  @SubscribeMessage('ai.gaze_offscreen')
  handleGazeOffscreen(
    @MessageBody() data: { sessionId: string; gazeDirection: any; message: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('ai.gaze_offscreen', {
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
  async handlePeerAnnounce(
    @MessageBody() data: { sessionId: string; role: string; socketId: string; candidateId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Update our client tracking with latest info
    const existing = this.clients.get(client.id) || {};
    this.clients.set(client.id, {
      ...existing,
      sessionId: data.sessionId,
      role: data.role,
      candidateId: data.candidateId,
    });

    // Notify all others in the session room that a new peer has joined
    client.to(`session:${data.sessionId}`).emit('peer.joined', {
      peerId: client.id,
      peerRole: data.role,
      candidateId: data.candidateId,
    });

    // ALSO notify the announcer about all existing peers in the session
    // This fixes the case where the proctor joins AFTER candidates are already in the room
    try {
      const room = this.server.sockets.adapter.rooms.get(`session:${data.sessionId}`);
      if (room) {
        for (const otherSocketId of room) {
          if (otherSocketId === client.id) continue;
          const other = this.clients.get(otherSocketId);
          if (!other?.role) continue;
          // Send peer.joined to the announcer for each existing peer
          client.emit('peer.joined', {
            peerId: otherSocketId,
            peerRole: other.role,
            candidateId: other.candidateId,
          });
        }
      }
    } catch {
      // Fail silently — room might not be ready yet
    }

    return { announced: true };
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

  // ── MULTI-CANDIDATE EVENTS ──────────────────────────────────────────────

  // ── Proctor enters verification for specific candidate ──────────────────
  @SubscribeMessage('proctor.enterVerification')
  handleProctorEnterVerification(
    @MessageBody() data: { sessionId: string; candidateId: string; candidateSocketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Notify the specific candidate that proctor is now verifying them
    this.server.to(`peer:${data.candidateSocketId}`).emit('proctor.enterVerification', {
      sessionId: data.sessionId,
      candidateId: data.candidateId,
      proctorSocketId: client.id,
      timestamp: new Date().toISOString(),
    });
    
    // Also activate audio for this candidate
    this.handleProctorActivateCandidate(
      { sessionId: data.sessionId, candidateSocketId: data.candidateSocketId },
      client,
    );
    
    return { entered: true };
  }

  // ── Proctor leaves verification for specific candidate ──────────────────
  @SubscribeMessage('proctor.leaveVerification')
  handleProctorLeaveVerification(
    @MessageBody() data: { sessionId: string; candidateId: string; candidateSocketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Notify the specific candidate that proctor has left
    this.server.to(`peer:${data.candidateSocketId}`).emit('proctor.leaveVerification', {
      sessionId: data.sessionId,
      candidateId: data.candidateId,
      timestamp: new Date().toISOString(),
    });
    
    // Also deactivate audio
    this.handleProctorDeactivateCandidate({ sessionId: data.sessionId }, client);
    
    return { left: true };
  }

  // ── Checklist item updated for specific candidate ───────────────────────
  @SubscribeMessage('checklist.itemUpdated')
  handleChecklistItemUpdated(
    @MessageBody() data: { sessionId: string; candidateId: string; itemId: string; status: string; candidateSocketId?: string },
  ) {
    // Notify the specific candidate about checklist update
    if (data.candidateSocketId) {
      this.server.to(`peer:${data.candidateSocketId}`).emit('checklist.itemUpdated', {
        sessionId: data.sessionId,
        candidateId: data.candidateId,
        itemId: data.itemId,
        status: data.status,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Also notify proctor
    this.server.to(`session:${data.sessionId}`).emit('checklist.itemUpdated', {
      sessionId: data.sessionId,
      candidateId: data.candidateId,
      itemId: data.itemId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
    
    return { updated: true };
  }

  // ── Candidate verification complete ──────────────────────────────────────
  @SubscribeMessage('checklist.candidateComplete')
  handleChecklistCandidateComplete(
    @MessageBody() data: { sessionId: string; candidateId: string },
  ) {
    // Track verified candidate
    if (!this.verifiedCandidates.has(data.sessionId)) {
      this.verifiedCandidates.set(data.sessionId, new Set());
    }
    this.verifiedCandidates.get(data.sessionId).add(data.candidateId);
    
    // Notify all in session
    this.server.to(`session:${data.sessionId}`).emit('checklist.candidateComplete', {
      sessionId: data.sessionId,
      candidateId: data.candidateId,
      timestamp: new Date().toISOString(),
    });
    
    return { completed: true };
  }

  // ── All candidates verified ──────────────────────────────────────────────
  @SubscribeMessage('proctor.allVerified')
  handleProctorAllVerified(
    @MessageBody() data: { sessionId: string; totalCandidates: number },
  ) {
    const verified = this.verifiedCandidates.get(data.sessionId);
    const allVerified = verified && verified.size === data.totalCandidates;
    
    if (allVerified) {
      // Notify all in session that verification is complete
      this.server.to(`session:${data.sessionId}`).emit('proctor.allVerified', {
        sessionId: data.sessionId,
        timestamp: new Date().toISOString(),
      });
    }
    
    return { allVerified, verifiedCount: verified?.size || 0 };
  }

  // ── Push MCQ exam to all candidates ──────────────────────────────────────
  @SubscribeMessage('exam.pushMCQ')
  handleExamPushMCQ(
    @MessageBody() data: { sessionId: string },
  ) {
    // Notify all candidates in session to start MCQ
    this.server.to(`session:${data.sessionId}`).emit('exam.pushMCQ', {
      sessionId: data.sessionId,
      timestamp: new Date().toISOString(),
    });
    
    return { pushed: true };
  }

  // ── Candidate MCQ submitted ──────────────────────────────────────────────
  @SubscribeMessage('exam.mcqSubmitted')
  handleExamMcqSubmitted(
    @MessageBody() data: { sessionId: string; candidateId: string; score?: number },
  ) {
    // Notify proctor about submission
    this.server.to(`session:${data.sessionId}`).emit('exam.mcqSubmitted', {
      sessionId: data.sessionId,
      candidateId: data.candidateId,
      score: data.score,
      timestamp: new Date().toISOString(),
    });
    
    return { submitted: true };
  }

  // ── All MCQ exams done ───────────────────────────────────────────────────
  @SubscribeMessage('exam.allMCQDone')
  handleExamAllMCQDone(
    @MessageBody() data: { sessionId: string },
  ) {
    // Notify proctor that all MCQ are complete
    this.server.to(`session:${data.sessionId}`).emit('exam.allMCQDone', {
      sessionId: data.sessionId,
      timestamp: new Date().toISOString(),
    });
    
    return { allDone: true };
  }

  // ── Push Practical exam to all candidates ────────────────────────────────
  @SubscribeMessage('exam.pushPractical')
  handleExamPushPractical(
    @MessageBody() data: { sessionId: string; practicalTask?: any },
  ) {
    // Notify all candidates in session to start practical
    this.server.to(`session:${data.sessionId}`).emit('exam.pushPractical', {
      sessionId: data.sessionId,
      practicalTask: data.practicalTask,
      timestamp: new Date().toISOString(),
    });
    
    return { pushed: true };
  }

  // ── Candidate disqualified ───────────────────────────────────────────────
  @SubscribeMessage('candidate.disqualified')
  handleCandidateDisqualified(
    @MessageBody() data: { sessionId: string; candidateId: string; reason: string; candidateSocketId?: string },
  ) {
    // Notify the specific candidate
    if (data.candidateSocketId) {
      this.server.to(`peer:${data.candidateSocketId}`).emit('candidate.disqualified', {
        sessionId: data.sessionId,
        candidateId: data.candidateId,
        reason: data.reason,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Notify all in session
    this.server.to(`session:${data.sessionId}`).emit('candidate.disqualified', {
      sessionId: data.sessionId,
      candidateId: data.candidateId,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    });
    
    return { disqualified: true };
  }

  // ── Server-side emit helpers (called from services) ──────────────────────
  emitToSession(sessionId: string, event: string, data: any) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }

  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }
}
