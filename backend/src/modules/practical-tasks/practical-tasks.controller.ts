import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { PracticalTasksService } from './practical-tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('practical-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('practical-tasks')
export class PracticalTasksController {
  constructor(private tasksService: PracticalTasksService) {}

  @Get()
  async getTasks(@Query() filters: any) {
    return this.tasksService.getTasks(filters);
  }

  @Get(':id')
  async getTask(@Param('id') id: string) {
    return this.tasksService.getTask(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async createTask(@Body() body: any, @Req() req: any) {
    return this.tasksService.createTask(body, req.user.id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async updateTask(@Param('id') id: string, @Body() body: any) {
    return this.tasksService.updateTask(id, body);
  }

  @Post(':id/archive')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async archiveTask(@Param('id') id: string) {
    return this.tasksService.archiveTask(id);
  }

  // Publish a DRAFT practical task so proctors can assign it and the
  // simulator (status='ACTIVE' filter) can see it. Without this, tasks
  // created via /exam-setup/practical get stranded in DRAFT and can
  // never be used in a real session.
  @Post(':id/activate')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async activateTask(@Param('id') id: string) {
    return this.tasksService.activateTask(id);
  }
}
