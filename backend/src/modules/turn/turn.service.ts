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

    try {
      const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Cloudflare TURN mint failed: HTTP ${res.status} ${body.slice(0, 200)}`);
        return { iceServers: [], provider: 'none' };
      }

      const data = await res.json();
      const iceServers = Array.isArray(data?.iceServers) ? data.iceServers : [];
      this.cached = {
        iceServers,
        // Cache for 23h so we refresh well before Cloudflare's 24h TTL expires.
        expiresAt: Date.now() + 23 * 60 * 60 * 1000,
      };
      this.logger.log(`Cloudflare TURN credentials minted (cached for 23h)`);
      return { iceServers, provider: 'cloudflare' };
    } catch (err: any) {
      this.logger.error(`Cloudflare TURN mint threw: ${err?.message || err}`);
      return { iceServers: [], provider: 'none' };
    }
  }
}
