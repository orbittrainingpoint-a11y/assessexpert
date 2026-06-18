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

  // ── Branding ────────────────────────────────────────────────────────────
  // HR / ORG_ADMIN read + update their OWN org's logo + brand display.
  // Super admin can read + update any org.
  @Get(':id/branding')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER', 'HIRING_MANAGER')
  async getBranding(@Param('id') id: string, @Req() req: any) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.organizationId !== id) {
      throw new ForbiddenException();
    }
    return this.orgsService.getBranding(id);
  }

  @Put(':id/branding')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER')
  async updateBranding(
    @Param('id') id: string,
    @Body() body: { logoUrl?: string | null; brandColor?: string | null; displayName?: string | null },
    @Req() req: any,
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.organizationId !== id) {
      throw new ForbiddenException();
    }
    return this.orgsService.updateBranding(id, body);
  }
}

// ── Public branding lookup ───────────────────────────────────────────────
// Candidates landing on /interview/<token> or /exam?token=... need the org
// logo BEFORE they're authenticated. This separate controller is mounted
// without guards so the public exam / interview pages can fetch the
// branding payload via the org id returned alongside their magic-link
// validation. Only the public-safe fields are exposed.
import { Controller as PublicController, Get as PublicGet, Param as PublicParam } from '@nestjs/common';

@ApiTags('organizations-public')
@PublicController('organizations/public')
export class OrganizationsPublicController {
  constructor(private orgsService: OrganizationsService) {}

  @PublicGet(':id/branding')
  async getPublicBranding(@PublicParam('id') id: string) {
    return this.orgsService.getBranding(id);
  }
}
