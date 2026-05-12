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

  // Candidate — magic-token auth instead of JWT
  @Get('candidate-token')
  async getCandidateToken(@Query('magicToken') magicToken: string) {
    if (!magicToken) throw new BadRequestException('magicToken required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken },
      include: { candidate: true },
    });
    if (!session) throw new BadRequestException('Invalid magic token');

    const candidateName = `${session.candidate.firstName} ${session.candidate.lastName}`;
    const room = this.jitsiService.roomNameForSession(session.id);
    const token = this.jitsiService.createToken({
      identity: `candidate-${session.candidate.id}`,
      name: candidateName,
      room,
      role: 'CANDIDATE',
    });

    return {
      token,
      domain: process.env.JITSI_DOMAIN || 'meet.jitsi',
      publicUrl: process.env.JITSI_PUBLIC_URL || `https://${process.env.JITSI_DOMAIN || 'meet.jitsi'}`,
      room,
      identity: `candidate-${session.candidate.id}`,
      sessionId: session.id,
    };
  }
}
