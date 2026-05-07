import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class InterviewsController {
  constructor(private interviewsService: InterviewsService) {}

  @Post('schedule')
  async schedule(@Body() body: any, @Req() req: any) {
    return this.interviewsService.schedule({
      ...body,
      organizationId: req.user.organizationId,
      scheduledBy: req.user.id,
      scheduledAt: new Date(body.scheduledAt),
    });
  }

  @Get()
  async getAll(@Query() filters: any, @Req() req: any) {
    return this.interviewsService.getAll({
      ...filters,
      organizationId: req.user.organizationId,
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.interviewsService.getOne(id);
  }

  @Post(':id/end')
  async end(@Param('id') id: string, @Body() body: any) {
    return this.interviewsService.end(id, body);
  }
}
