import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment-types')
export class AssessmentsController {
  constructor(private assessmentsService: AssessmentsService) {}

  @Get()
  async getAssessmentTypes(@Query() filters: any) {
    return this.assessmentsService.getAssessmentTypes(filters);
  }

  @Get(':id')
  async getAssessmentType(@Param('id') id: string) {
    return this.assessmentsService.getAssessmentType(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async createAssessmentType(@Body() body: any, @Req() req: any) {
    return this.assessmentsService.createAssessmentType(body, req.user.id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async updateAssessmentType(@Param('id') id: string, @Body() body: any) {
    return this.assessmentsService.updateAssessmentType(id, body);
  }

  @Post(':id/archive')
  @Roles('SUPER_ADMIN')
  async archiveAssessmentType(@Param('id') id: string) {
    return this.assessmentsService.archiveAssessmentType(id);
  }

  // Flip DRAFT (or ARCHIVED) → ACTIVE so HR can schedule candidates
  // against the type. Same role gate as create — SUPER_ADMIN or
  // MASTER_PROCTOR own the activation decision.
  @Post(':id/activate')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async activateAssessmentType(@Param('id') id: string) {
    return this.assessmentsService.activateAssessmentType(id);
  }
}
