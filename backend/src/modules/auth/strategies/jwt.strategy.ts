import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

// Read the JWT from the httpOnly `access_token` cookie set by
// auth.controller.ts, falling back to the classic Authorization: Bearer
// header. Cookie path is preferred so XSS can't lift the token; header
// path is retained for the migration window (frontend consumers that
// still call fetch directly with an Authorization header) and for
// third-party integrations that want the OAuth-style bearer flow.
function tokenFromRequest(req: Request): string | null {
  const cookieToken = (req as any).cookies?.access_token;
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req) || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([tokenFromRequest as any]),
      ignoreExpiration: false,
      // bootstrap (main.ts) refuses to start without JWT_SECRET, so
      // we know it's set by the time Passport instantiates the strategy.
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };
  }
}
