import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JitsiController } from './jitsi.controller';
import { JitsiService } from './jitsi.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [JitsiController],
  providers: [JitsiService],
  exports: [JitsiService],
})
export class JitsiModule {}
