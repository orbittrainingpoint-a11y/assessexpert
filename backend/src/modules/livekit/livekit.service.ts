import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private apiKey = process.env.LIVEKIT_API_KEY || '';
  private apiSecret = process.env.LIVEKIT_API_SECRET || '';

  async createToken(params: {
    identity: string;
    room: string;
    name?: string;
    role: 'PROCTOR' | 'CANDIDATE' | 'OBSERVER';
    canPublish?: boolean;
    canSubscribe?: boolean;
  }) {
    if (!this.apiKey || !this.apiSecret) {
      throw new InternalServerErrorException(
        'LiveKit credentials missing. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env',
      );
    }

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.identity,
      name: params.name || params.identity,
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room: params.room,
      canPublish: params.canPublish ?? true,
      canSubscribe: params.canSubscribe ?? true,
      canPublishData: true,
      // Proctors can also manage room (kick, mute) if needed later
      roomAdmin: params.role === 'PROCTOR',
    });

    return at.toJwt();
  }
}
