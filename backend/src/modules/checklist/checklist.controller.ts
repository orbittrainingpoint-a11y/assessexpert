import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('checklist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('checklist')
export class ChecklistController {
  constructor(private checklistService: ChecklistService) {}

  @Get('template')
  getTemplate() {
    return this.checklistService.getChecklistTemplate();
  }

  @Post(':sessionId/init')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async initChecklist(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.checklistService.initChecklist(sessionId, req.user.id);
  }

  @Get(':sessionId')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getChecklist(@Param('sessionId') sessionId: string) {
    return this.checklistService.getChecklist(sessionId);
  }

  @Post(':sessionId/items/:itemKey/complete')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async completeItem(
    @Param('sessionId') sessionId: string,
    @Param('itemKey') itemKey: string,
    @Body() body: { notes?: string; value?: any },
    @Req() req: any,
  ) {
    return this.checklistService.completeItem(sessionId, itemKey, body, req.user.id);
  }
}
