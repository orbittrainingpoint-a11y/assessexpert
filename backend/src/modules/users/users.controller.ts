import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  async getUsers(@Query() filters: any) {
    return this.usersService.getUsers(filters);
  }

  @Get('proctors')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async getProctors(@Query() filters: any) {
    return this.usersService.getProctors(filters);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  async createUser(@Body() body: any) {
    return this.usersService.createUser(body);
  }

  @Post('invite')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  async inviteUser(@Body() body: any, @Req() req: any) {
    return this.usersService.inviteUser(body, req.user.id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateUser(id, body);
  }

  @Post(':id/deactivate')
  @Roles('SUPER_ADMIN')
  async deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Get(':id/availability')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getAvailability(@Param('id') id: string, @Req() req: any) {
    // Proctors can only view their own availability
    if (req.user.role === 'PROCTOR' && req.user.id !== id) {
      throw new ForbiddenException('You can only view your own availability');
    }
    return this.usersService.getAvailability(id);
  }

  @Post(':id/availability')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async saveAvailability(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    // Proctors can only update their own availability
    if (req.user.role === 'PROCTOR' && req.user.id !== id) {
      throw new ForbiddenException('You can only update your own availability');
    }
    return this.usersService.saveAvailability(id, body);
  }
}
