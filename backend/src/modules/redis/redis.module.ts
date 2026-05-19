import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// Global so individual modules don't have to import RedisModule
// explicitly. There's only ever one Redis client per process.
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
