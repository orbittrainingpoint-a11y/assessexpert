import { Controller, Get, HttpCode } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './modules/redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // Liveness — cheap. Answers "is the process alive and receiving
  // requests?". No dependency checks. Point uptime monitors here for
  // low false-positive rate; if this returns 200 the process is up
  // enough to route requests, even if a downstream dep is degraded.
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'assessexpert-api',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  // Readiness — checks the dependencies the app needs to serve real
  // traffic. Returns 200 only if EVERY dependency is healthy. Blue-
  // green / load-balancer health checks should point here so a node
  // is only marked "ready" when it can genuinely serve.
  //
  // Status codes: 200 if all up, 503 if any dep down. Body always
  // includes per-check status so an operator can see which one failed.
  @Get('ready')
  async ready() {
    const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
    let allOk = true;

    // Postgres via Prisma. `SELECT 1` is the cheapest round-trip;
    // 2s is a generous timeout — any DB responding slower than that
    // is functionally down for our request path.
    checks.database = await this.checkWithTimeout(async () => {
      await this.prisma.$queryRaw`SELECT 1`;
    }, 2000);
    if (!checks.database.ok) allOk = false;

    // Redis. Optional — if REDIS_URL is unset we run on the in-memory
    // fallback and Redis "up" is a no-op. Only counts as unhealthy
    // if we tried to connect (URL set) and failed.
    if (process.env.REDIS_URL) {
      checks.redis = await this.checkWithTimeout(async () => {
        await this.redis.get('__healthcheck__'); // returns null if missing — that's fine
      }, 1000);
      if (!checks.redis.ok) allOk = false;
    } else {
      checks.redis = { ok: true, latencyMs: 0 };
    }

    // Filesystem — can we write to the storage dir?
    checks.storage = await this.checkWithTimeout(async () => {
      const fs = await import('fs/promises');
      const path = process.env.STORAGE_PATH || './storage';
      await fs.access(path);
    }, 500);
    if (!checks.storage.ok) allOk = false;

    const body = {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'assessexpert-api',
      checks,
    };

    if (!allOk) {
      // NestJS sets 200 by default on returned objects. We need 503
      // for "not ready" so load balancers pull the node from rotation.
      // Throw the shaped body inside an HttpException so both the
      // status code AND the details reach the caller.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { HttpException } = require('@nestjs/common');
      throw new HttpException(body, 503);
    }
    return body;
  }

  // Small helper — runs `fn` with a timeout, returns a normalised
  // { ok, latencyMs, error? } tuple. Keeps the readiness handler
  // above declarative.
  private async checkWithTimeout(fn: () => Promise<void>, timeoutMs: number) {
    const started = Date.now();
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)),
      ]);
      return { ok: true, latencyMs: Date.now() - started };
    } catch (e: any) {
      return { ok: false, latencyMs: Date.now() - started, error: e?.message || String(e) };
    }
  }
}
