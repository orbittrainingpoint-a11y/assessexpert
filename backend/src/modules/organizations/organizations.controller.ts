import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SALES_AGENT')
  async getOrganizations(@Query() filters: any) {
    return this.orgsService.getOrganizations(filters);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN')
  async getStats() {
    return this.orgsService.getDashboardStats();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SALES_AGENT', 'ORG_ADMIN', 'HR_MANAGER')
  async getOrganization(@Param('id') id: string, @Req() req: any) {
    // ORG_ADMIN and HR_MANAGER can only read their own org
    if (['ORG_ADMIN', 'HR_MANAGER'].includes(req.user.role) && req.user.organizationId !== id) {
      throw new ForbiddenException();
    }
    return this.orgsService.getOrganization(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  async createOrganization(@Body() body: any) {
    return this.orgsService.createOrganization(body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN')
  async updateOrganization(@Param('id') id: string, @Body() body: any) {
    return this.orgsService.updateOrganization(id, body);
  }

  @Post(':id/suspend')
  @Roles('SUPER_ADMIN')
  async suspendOrganization(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.orgsService.suspendOrganization(id, body.reason);
  }
}
