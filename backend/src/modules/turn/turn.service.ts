import { Injectable, Logger } from '@nestjs/common';

/**
 * Cloudflare TURN credential minter.
 *
 * Cloudflare's TURN service uses short-lived credentials: the browser receives
 * a username + password generated server-side, valid for `ttl` seconds. We
 * expose those via GET /api/turn/credentials so both authenticated proctors
 * and unauthenticated (magic-token-only) candidates can fetch them.
 *
 * The minted credentials live for 24h; we cache them server-side for 23h to
 * avoid hammering the Cloudflare API on every PeerConnection setup.
 */
@Injectable()
export class TurnService {
  private readonly logger = new Logger(TurnService.name);
  private cached: { iceServers: any[]; expiresAt: number } | null = null;

  async getIceServers(): Promise<{ iceServers: any[]; provider: 'cloudflare' | 'none' }> {
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return { iceServers: this.cached.iceServers, provider: 'cloudflare' };
    }

    const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
    const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
    if (!keyId || !apiToken) {
      this.logger.warn('Cloudflare TURN not configured (CLOUDFLARE_TURN_KEY_ID / CLOUDFLARE_TURN_API_TOKEN missing). Falling back to self-hosted only.');
      return { iceServers: [], provider: 'none' };
    }

    // Try up to 3 times with exponential backoff. Cloudflare's API
    // occasionally 5xx's during PoP rolls — without a retry, one transient
    // failure would empty the cache for 23h and every candidate connecting
    // in that window falls back to self-hosted TURN (which is blocked on
    // restrictive networks). Retry on network errors AND on 5xx HTTP.
    const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: 86400 }),
        });

        // 4xx is permanent (bad key, malformed request) — don't retry.
        if (res.status >= 400 && res.status < 500) {
          const body = await res.text().catch(() => '');
          this.logger.error(`Cloudflare TURN mint failed permanently: HTTP ${res.status} ${body.slice(0, 200)}`);
          return { iceServers: [], provider: 'none' };
        }
        // 5xx — retryable.
        if (!res.ok) {
          if (attempt < MAX_ATTEMPTS) {
            const wait = 200 * Math.pow(2, attempt - 1); // 200ms, 400ms
            this.logger.warn(`Cloudflare TURN mint 5xx (attempt ${attempt}/${MAX_ATTEMPTS}, retry in ${wait}ms): HTTP ${res.status}`);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          this.logger.error(`Cloudflare TURN mint failed after ${MAX_ATTEMPTS} attempts: HTTP ${res.status}`);
          return { iceServers: [], provider: 'none' };
        }

        const data = await res.json();
        const iceServers = Array.isArray(data?.iceServers) ? data.iceServers : [];
        this.cached = {
          iceServers,
          // Cache for 23h so we refresh well before Cloudflare's 24h TTL expires.
          expiresAt: Date.now() + 23 * 60 * 60 * 1000,
        };
        if (attempt > 1) {
          this.logger.log(`Cloudflare TURN credentials minted on attempt ${attempt} (cached for 23h)`);
        } else {
          this.logger.log(`Cloudflare TURN credentials minted (cached for 23h)`);
        }
        return { iceServers, provider: 'cloudflare' };
      } catch (err: any) {
        // Network error — retry
        if (attempt < MAX_ATTEMPTS) {
          const wait = 200 * Math.pow(2, attempt - 1);
          this.logger.warn(`Cloudflare TURN mint network error (attempt ${attempt}/${MAX_ATTEMPTS}, retry in ${wait}ms): ${err?.message || err}`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        this.logger.error(`Cloudflare TURN mint network error after ${MAX_ATTEMPTS} attempts: ${err?.message || err}`);
        return { iceServers: [], provider: 'none' };
      }
    }
    return { iceServers: [], provider: 'none' };
  }
}
