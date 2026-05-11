import { Module } from '@nestjs/common';
import { PracticalSetsController } from './practical-sets.controller';
import { PracticalSetsService } from './practical-sets.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, StorageModule, GatewayModule],
  controllers: [PracticalSetsController],
  providers: [PracticalSetsService],
  exports: [PracticalSetsService],
})
export class PracticalSetsModule {}
