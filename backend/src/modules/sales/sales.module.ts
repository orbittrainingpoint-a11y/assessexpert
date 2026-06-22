import { Module } from '@nestjs/common';
import { SalesController, SalesPublicController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  // SalesPublicController serves the unauthenticated POST /sales/leads
  // (marketing contact form). SalesController serves the admin/auth
  // routes (list / update). Both share the same SalesService.
  controllers: [SalesPublicController, SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
