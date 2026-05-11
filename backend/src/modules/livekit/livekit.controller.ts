import { Controller, Get, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('livekit')
@Controller('livekit')
export class LivekitController {
  constructor(
    private livekitService: LivekitService,
    private prisma: PrismaService,
  ) {}

  // Proctor / Master Proctor: needs JWT auth
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proctor-token')
  async getProctorToken(@Query('sessionId') sessionId: string, @Req() req: any) {
    if (!sessionId) throw new BadRequestException('sessionId required');
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');

    const token = await this.livekitService.createToken({
      identity: `proctor-${req.user.id}`,
      name: req.user.email || 'Proctor',
      room: `session-${sessionId}`,
      role: 'PROCTOR',
    });

    return {
      token,
      wsUrl: process.env.LIVEKIT_WS_URL || 'ws://localhost:7880',
      room: `session-${sessionId}`,
      identity: `proctor-${req.user.id}`,
    };
  }

  // Candidate: uses magic token instead of JWT
  @Get('candidate-token')
  async getCandidateToken(
    @Query('magicToken') magicToken: string,
  ) {
    if (!magicToken) throw new BadRequestException('magicToken required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken },
      include: { candidate: true },
    });
    if (!session) throw new BadRequestException('Invalid magic token');

    const candidateName = `${session.candidate.firstName} ${session.candidate.lastName}`;
    const token = await this.livekitService.createToken({
      identity: `candidate-${session.candidate.id}`,
      name: candidateName,
      room: `session-${session.id}`,
      role: 'CANDIDATE',
    });

    return {
      token,
      wsUrl: process.env.LIVEKIT_WS_URL || 'ws://localhost:7880',
      room: `session-${session.id}`,
      identity: `candidate-${session.candidate.id}`,
      sessionId: session.id,
    };
  }
}
