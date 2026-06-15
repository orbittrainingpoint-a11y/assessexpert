import { Controller, Get } from '@nestjs/common';
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
  @Get('credentials')
  async getCredentials() {
    return this.turn.getIceServers();
  }
}
