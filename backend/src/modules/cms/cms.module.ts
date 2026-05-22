import { Module } from '@nestjs/common';
import { CmsController, CmsAdminController } from './cms.controller';
import { CmsService } from './cms.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [CmsController, CmsAdminController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
