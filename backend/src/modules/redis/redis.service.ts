import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Optional Redis client. Activated by setting REDIS_URL in the env;
 * otherwise this service falls back to a single-process in-memory store
 * so a vanilla dev box keeps working without infra. Callers should
 * always go through the typed helpers (get/setex/incr/del) so the
 * in-memory fallback stays a drop-in replacement for redis.
 *
 * We deliberately don't crash on connect errors. The OTP and reminder
 * paths fall back to their non-Redis behaviour rather than killing the
 * exam — Redis outages are recoverable for what we use it for here.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private connected = false;
  // In-memory shadow used when REDIS_URL is unset. Mirrors the subset of
  // Redis semantics we actually use: SET with EX (ttl), GET, INCR, DEL.
  private memStore = new Map<string, { value: string; expiresAt: number | null }>();

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.log('REDIS_URL not set — using in-memory fallback');
      return;
    }
    try {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        // Reconnect on failover but don't spam logs while down.
        retryStrategy: times => Math.min(times * 200, 2000),
      });
      this.client.on('connect', () => {
        this.connected = true;
        this.logger.log('Redis connected');
      });
      this.client.on('error', err => {
        this.connected = false;
        this.logger.warn(`Redis error: ${err.message}`);
      });
      this.client.connect().catch(err =>
        this.logger.warn(`Redis initial connect failed (will retry): ${err.message}`),
      );
    } catch (e) {
      this.logger.warn(`Failed to instantiate Redis client: ${(e as Error).message}`);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try { await this.client.quit(); } catch {}
  }

  // Whether the live Redis path is available. Bull setup checks this so
  // we know whether to register the queue or stub it out.
  isEnabled(): boolean {
    return !!this.client && this.connected;
  }

  // Underlying ioredis client for callers that need raw access (e.g. the
  // socket.io adapter, if/when we wire it). Returns null when REDIS_URL
  // is unset — callers MUST handle that.
  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (this.client && this.connected) {
      try { return await this.client.get(key); } catch (e) {
        this.logger.warn(`get ${key} failed: ${(e as Error).message}, falling back`);
      }
    }
    return this.memGet(key);
  }

  // SET key value EX ttlSeconds — used for OTPs and other expiring tokens.
  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (this.client && this.connected) {
      try { await this.client.setex(key, ttlSeconds, value); return; } catch (e) {
        this.logger.warn(`setex ${key} failed: ${(e as Error).message}, falling back`);
      }
    }
    this.memSet(key, value, ttlSeconds * 1000);
  }

  async incr(key: string): Promise<number> {
    if (this.client && this.connected) {
      try { return await this.client.incr(key); } catch (e) {
        this.logger.warn(`incr ${key} failed: ${(e as Error).message}, falling back`);
      }
    }
    const current = parseInt(this.memGet(key) || '0', 10);
    const next = current + 1;
    // INCR doesn't change TTL on existing keys; mirror that here.
    const existing = this.memStore.get(key);
    this.memStore.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? null });
    return next;
  }

  async del(key: string): Promise<void> {
    if (this.client && this.connected) {
      try { await this.client.del(key); return; } catch (e) {
        this.logger.warn(`del ${key} failed: ${(e as Error).message}, falling back`);
      }
    }
    this.memStore.delete(key);
  }

  // Set / refresh TTL on an existing key. Used by the per-email OTP rate
  // limiter to apply a window only on the first request — subsequent
  // INCRs within the window leave the TTL alone, which is exactly the
  // Redis EXPIRE NX semantic we want.
  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.client && this.connected) {
      try { await this.client.expire(key, ttlSeconds); return; } catch (e) {
        this.logger.warn(`expire ${key} failed: ${(e as Error).message}, falling back`);
      }
    }
    const entry = this.memStore.get(key);
    if (entry) {
      this.memStore.set(key, { value: entry.value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  }

  // ── In-memory fallback ───────────────────────────────────────────────

  private memGet(key: string): string | null {
    const entry = this.memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memStore.delete(key);
      return null;
    }
    return entry.value;
  }

  private memSet(key: string, value: string, ttlMs: number) {
    this.memStore.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
    });
  }
}
