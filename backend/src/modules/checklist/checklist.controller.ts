import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('checklist')
@Controller('checklist')
export class ChecklistController {
  constructor(
    private checklistService: ChecklistService,
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

  // Public endpoint — candidate polls checklist progress using their magic token
  @Get('by-token')
  async getChecklistByToken(@Query('token') token: string) {
    const session = await this.prisma.examSession.findUnique({ where: { magicToken: token } });
    if (!session) return { items: [] };
    try {
      return await this.checklistService.getChecklist(session.id);
    } catch {
      return { items: [] };
    }
  }

  @Get('template')
  getTemplate() {
    return this.checklistService.getChecklistTemplate();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':sessionId/init')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async initChecklist(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.checklistService.initChecklist(sessionId, req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':sessionId')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getChecklist(@Param('sessionId') sessionId: string) {
    return this.checklistService.getChecklist(sessionId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':sessionId/items/:itemKey/complete')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async completeItem(
    @Param('sessionId') sessionId: string,
    @Param('itemKey') itemKey: string,
    @Body() body: { notes?: string; value?: any; candidateId?: string },
    @Req() req: any,
  ) {
    const result = await this.checklistService.completeItem(sessionId, itemKey, body, req.user.id);
    // Broadcast checklist update to all session participants. The `candidateId`
    // tag lets candidate browsers filter out events that aren't for them so
    // popups (screen share, guidelines, etc.) only fire on the right person.
    this.gateway.emitToSession(sessionId, 'checklist.itemUpdated', {
      sessionId,
      candidateId: body.candidateId,
      itemId: itemKey,
      itemKey,
      status: 'done',
      timestamp: new Date().toISOString(),
    });
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':sessionId/all-verified')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async checkAllVerified(@Param('sessionId') sessionId: string) {
    const allComplete = await this.checklistService.areAllChecklistsComplete(sessionId);
    return { allVerified: allComplete };
  }
}
