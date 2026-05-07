import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Get('dashboard/stats')
  @Roles('SALES_AGENT', 'SUPER_ADMIN')
  async getStats(@Req() req: any) {
    return this.salesService.getDashboardStats(req.user.id);
  }

  @Get('leads')
  @Roles('SALES_AGENT', 'SUPER_ADMIN')
  async getLeads(@Req() req: any, @Query() filters: any) {
    const agentId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.id;
    return this.salesService.getLeads(agentId, filters);
  }

  @Post('leads')
  async createLead(@Body() body: any) {
    return this.salesService.createLead(body);
  }

  @Put('leads/:id')
  @Roles('SALES_AGENT', 'SUPER_ADMIN')
  async updateLead(@Param('id') id: string, @Body() body: any) {
    return this.salesService.updateLead(id, body);
  }

  @Get('companies')
  @Roles('SALES_AGENT', 'SUPER_ADMIN')
  async getMyCompanies(@Req() req: any) {
    return this.salesService.getMyCompanies(req.user.id);
  }
}
