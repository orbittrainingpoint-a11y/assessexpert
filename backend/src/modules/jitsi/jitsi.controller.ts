import { Controller, Get, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JitsiService } from './jitsi.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('jitsi')
@Controller('jitsi')
export class JitsiController {
  constructor(
    private jitsiService: JitsiService,
    private prisma: PrismaService,
  ) {}

  // Proctor / Master Proctor — must be authenticated
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proctor-token')
  async getProctorToken(@Query('sessionId') sessionId: string, @Req() req: any) {
    if (!sessionId) throw new BadRequestException('sessionId required');
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');

    const room = this.jitsiService.roomNameForSession(sessionId);
    const token = this.jitsiService.createToken({
      identity: `proctor-${req.user.id}`,
      name: req.user.email || 'Proctor',
      room,
      role: 'PROCTOR',
    });

    return {
      token,
      domain: process.env.JITSI_DOMAIN || 'meet.jitsi',
      publicUrl: process.env.JITSI_PUBLIC_URL || `https://${process.env.JITSI_DOMAIN || 'meet.jitsi'}`,
      room,
      identity: `proctor-${req.user.id}`,
    };
  }

  // Candidate — magic-token auth instead of JWT.
  // candidateId is optional: when the link is shared by a multi-candidate
  // slot, the candidate provides their own candidateId (resolved by OTP
  // verification) so each candidate gets a UNIQUE WebRTC identity.
  // Without it, we fall back to the primary candidate on the session.
  @Get('candidate-token')
  async getCandidateToken(
    @Query('magicToken') magicToken: string,
    @Query('candidateId') candidateId?: string,
  ) {
    if (!magicToken) throw new BadRequestException('magicToken required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken },
      include: {
        candidate: true,
        sessionCandidates: { include: { candidate: true } },
      },
    });
    if (!session) throw new BadRequestException('Invalid magic token');

    // Resolve which candidate this request represents
    let candidate: { id: string; firstName: string; lastName: string } = session.candidate;
    if (candidateId && candidateId !== session.candidate.id) {
      const match = session.sessionCandidates.find(sc => sc.candidate.id === candidateId);
      if (!match) {
        throw new BadRequestException('candidateId is not part of this session');
      }
      candidate = match.candidate;
    }

    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const room = this.jitsiService.roomNameForSession(session.id);
    const token = this.jitsiService.createToken({
      identity: `candidate-${candidate.id}`,
      name: candidateName,
      room,
      role: 'CANDIDATE',
    });

    return {
      token,
      domain: process.env.JITSI_DOMAIN || 'meet.jitsi',
      publicUrl: process.env.JITSI_PUBLIC_URL || `https://${process.env.JITSI_DOMAIN || 'meet.jitsi'}`,
      room,
      identity: `candidate-${candidate.id}`,
      candidateId: candidate.id,
      candidateName,
      sessionId: session.id,
      isMultiCandidate: session.isMultiCandidate,
    };
  }
}
