import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Mints Jitsi-compatible JWTs.
 *
 * Jitsi's prosody/mod_auth_token expects this claim shape:
 *   {
 *     iss: <JWT_APP_ID>,
 *     aud: "jitsi",
 *     sub: <JITSI_DOMAIN>,
 *     room: "<room-name>" | "*",
 *     exp: <unix-seconds>,
 *     context: { user: { name, id, avatar? } }
 *   }
 *
 * The matching server-side env vars (in the Jitsi docker .env) are:
 *   JWT_APP_ID, JWT_APP_SECRET, JWT_ACCEPTED_ISSUERS, JWT_ACCEPTED_AUDIENCES
 */
@Injectable()
export class JitsiService {
  private appId = process.env.JITSI_APP_ID || 'assessexpert';
  private appSecret = process.env.JITSI_APP_SECRET || '';
  private domain = process.env.JITSI_DOMAIN || 'meet.jitsi';

  constructor(private jwt: JwtService) {}

  createToken(params: {
    identity: string;
    room: string;
    name?: string;
    role: 'PROCTOR' | 'CANDIDATE' | 'OBSERVER';
  }): string {
    if (!this.appSecret) {
      throw new InternalServerErrorException(
        'Jitsi credentials missing. Set JITSI_APP_SECRET (matching JWT_APP_SECRET on the Jitsi server) in backend .env',
      );
    }

    const isModerator = params.role === 'PROCTOR';
    const payload: Record<string, any> = {
      aud: 'jitsi',
      iss: this.appId,
      sub: this.domain,
      room: params.room,
      // 4-hour TTL like the old LiveKit setup
      exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
      context: {
        user: {
          id: params.identity,
          name: params.name || params.identity,
          // Jitsi treats moderator true as "can mute/kick others"
          moderator: isModerator ? 'true' : 'false',
        },
        features: {
          recording: isModerator ? 'true' : 'false',
          livestreaming: 'false',
          'screen-sharing': 'true',
        },
      },
    };

    return this.jwt.sign(payload, { secret: this.appSecret, algorithm: 'HS256' });
  }

  // Stable room name from a session id. Jitsi rooms are lowercase and can't
  // contain '@' or '/'; cuids are safe but we lowercase to be cautious.
  roomNameForSession(sessionId: string): string {
    return `assessexpert-${sessionId.toLowerCase()}`;
  }
}
