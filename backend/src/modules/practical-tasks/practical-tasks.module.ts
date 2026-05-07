import { Module } from '@nestjs/common';
import { PracticalTasksController } from './practical-tasks.controller';
import { PracticalTasksService } from './practical-tasks.service';

@Module({
  controllers: [PracticalTasksController],
  providers: [PracticalTasksService],
  exports: [PracticalTasksService],
})
export class PracticalTasksModule {}
