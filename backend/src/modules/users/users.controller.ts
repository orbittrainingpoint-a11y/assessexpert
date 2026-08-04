import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Public — no auth required
  @Get('invitation/:token')
  getInvitation(@Param('token') token: string) {
    return this.usersService.getInvitation(token);
  }

  @Post('accept-invitation')
  acceptInvitation(@Body() body: any) {
    return this.usersService.acceptInvitation(body.token, body);
  }

  // Protected routes
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get()
  getUsers(@Query() filters: any) {
    return this.usersService.getUsers(filters);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  @Get('proctors')
  getProctors(@Query() filters: any) {
    return this.usersService.getProctors(filters);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post()
  createUser(@Body() body: any) {
    return this.usersService.createUser(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @Post('invite')
  inviteUser(@Body() body: any, @Req() req: any) {
    return this.usersService.inviteUser(body, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }

  // Self-service profile update — PORTAL_GAPS.md L3.
  // Any authenticated user can update THEIR OWN safe fields
  // (firstName, lastName, phone, notification preferences). The
  // controller passes req.user.id so the caller can't sneak in a
  // different id and edit someone else's row; role/status/email
  // are stripped by the service allowlist.
  @UseGuards(JwtAuthGuard)
  @Put('me')
  updateMe(
    @Req() req: any,
    @Body() body: { firstName?: string; lastName?: string; phone?: string; notificationsEmail?: boolean },
  ) {
    return this.usersService.updateProfileSelf(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Put(':id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateUser(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post(':id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  // Reverse of deactivate. Flips an INACTIVE user back to ACTIVE.
  // Refuses if the user is already DELETED.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post(':id/reactivate')
  reactivateUser(@Param('id') id: string) {
    return this.usersService.reactivateUser(id);
  }

  // Soft delete — status → DELETED, deletedAt stamped. Row is preserved
  // for FK integrity; excluded from default queries.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  // Admin-triggered password reset for a specific user. Same underlying
  // flow as the public POST /auth/forgot-password but the actor is an
  // admin, not the user. Sends a 1-hour reset link to the user's email.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post(':id/send-password-reset')
  sendPasswordReset(@Param('id') id: string) {
    return this.usersService.adminSendPasswordReset(id);
  }

  // Admin panel — see every invitation with its status (PENDING /
  // ACCEPTED / EXPIRED). Powers the pending-invitations table on
  // /admin/users.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @Get('invitations/list')
  async listInvitations(@Req() req: any, @Query() query: any) {
    // ORG_ADMIN is scoped to their own org; SUPER_ADMIN sees all
    // unless they explicitly filter.
    const organizationId = req.user.role === 'SUPER_ADMIN'
      ? query.organizationId
      : req.user.organizationId;
    return this.usersService.listInvitations({ organizationId, limit: query.limit });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @Post('invitations/:id/resend')
  resendInvitation(@Param('id') id: string, @Req() req: any) {
    return this.usersService.resendInvitation(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @Delete('invitations/:id')
  revokeInvitation(@Param('id') id: string) {
    return this.usersService.revokeInvitation(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  @Get(':id/availability')
  getAvailability(@Param('id') id: string, @Req() req: any) {
    if (req.user.role === 'PROCTOR' && req.user.id !== id) {
      throw new ForbiddenException('You can only view your own availability');
    }
    return this.usersService.getAvailability(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  @Post(':id/availability')
  saveAvailability(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (req.user.role === 'PROCTOR' && req.user.id !== id) {
      throw new ForbiddenException('You can only update your own availability');
    }
    return this.usersService.saveAvailability(id, body);
  }
}
