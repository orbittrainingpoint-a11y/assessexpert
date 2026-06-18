import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TurnService } from './turn.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('turn')
@Controller('turn')
export class TurnController {
  constructor(private turn: TurnService) {}

  // Intentionally public — both authenticated proctors and unauthenticated
  // (magic-token-only) candidates need to fetch ICE servers at the start of
  // every interview/exam. The Cloudflare API token never leaves the server;
  // only the short-lived minted credentials reach the browser.
  //
  // RATE LIMIT — 30 calls per minute per IP. The endpoint serves a 23h
  // server-side cache so legitimate use is well under this. Without the
  // throttle, a malicious client can hammer Cloudflare's API on our key
  // and either exhaust the 1TB free tier or get our key rate-limited by
  // Cloudflare, breaking real sessions.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('credentials')
  async getCredentials() {
    return this.turn.getIceServers();
  }
}
