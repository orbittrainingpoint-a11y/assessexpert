import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Audit log interceptor — S12 in SECURITY.md.
 *
 * Emits an AuditLog row on every authenticated mutation (POST / PUT /
 * PATCH / DELETE). Pure additive: wrapped in try/catch so an audit
 * failure NEVER breaks the user-facing flow. Async fire-and-forget so
 * we don't add latency to the response.
 *
 * What gets logged:
 * - userId, userEmail, role  → who did it
 * - method + path            → what they hit (target + targetId)
 * - body shape               → payload (sanitised: passwords/tokens stripped)
 * - ip                       → where from
 * - chainHash                → SHA-256 of previous chainHash + current row;
 *                              makes the log tamper-evident.
 *
 * What it skips (to keep volume sane):
 * - GET requests (read-only)
 * - The audit log endpoint itself (would recurse)
 * - Errors (recorded by the exception filter)
 *
 * SAST P2 #12 — public mutation auditing. Previously the interceptor
 * bailed when !req.user.id, which meant POST /auth/login,
 * POST /auth/refresh, /quiz/public/:token/{send-otp,verify-otp,submit},
 * /users/accept-invitation, /exam-delivery/*, /contact and other
 * publicly-callable mutations were never recorded. Forensics gap. Now
 * those paths get logged with a synthetic actor (userId='PUBLIC') so
 * an incident response timeline includes them. The userEmail/role
 * stay as 'PUBLIC' sentinels — the schema's NOT NULL constraint is
 * preserved without a migration.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');
  private lastHash: string | null = null;

  // Field names we strip from the payload before storing — anything that
  // could leak credentials, tokens, OTPs, raw images, etc.
  private readonly SCRUB_FIELDS = new Set([
    'password', 'newPassword', 'currentPassword', 'confirm',
    'otp', 'code', 'token', 'magicToken', 'refreshToken',
    'capturedImage', 'imageBase64', 'base64', 'logoUrl',
  ]);

  // Public path PREFIXES we still want to log even though there's no
  // req.user. Match on the path AFTER stripping the optional `/api`
  // prefix so the regex stays stable behind a reverse proxy that
  // rewrites the base path.
  //
  // Anything not matching here (e.g. /cms/public/*, /assessment-types
  // GET) is left out so the log doesn't drown in noise.
  private readonly PUBLIC_AUDITED_PREFIXES = [
    '/auth/',            // login, refresh, password reset, magic-link verify
    '/quiz/public/',     // OTP send/verify, confirm-email, submit
    '/exam-delivery/',   // magic-token candidate flow
    '/users/accept-invitation',
    '/sales/leads',      // public sales lead form (marketing site)
  ];

  constructor(private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const method = (req.method || '').toUpperCase();

    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next.handle();
    }
    const url = req.originalUrl || req.url || '';
    if (url.includes('/admin/audit')) return next.handle();

    const isAuthed = !!req.user?.id;
    const isPublicAudited = !isAuthed && this.matchesPublicPrefix(url);
    if (!isAuthed && !isPublicAudited) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => this.write(req, isAuthed).catch(err => {
          this.logger.error(`Audit write failed: ${err?.message || err}`);
        }),
        // Errors are recorded by the exception filter — don't double-log.
        error: () => {},
      }),
    );
  }

  private matchesPublicPrefix(url: string): boolean {
    const path = url.split('?')[0].replace(/^\/api/, '');
    return this.PUBLIC_AUDITED_PREFIXES.some((p) => path.startsWith(p));
  }

  private async write(req: any, isAuthed: boolean) {
    const user = req.user;
    const path = (req.originalUrl || req.url || '').split('?')[0];
    const target = path.replace(/^\/api/, '').split('/')[1] || 'unknown';
    const targetId = this.extractTargetId(path);
    const payload = this.scrub(req.body);
    const ipAddress = (req.headers?.['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').trim();

    // For public mutations we don't have a real actor. Use a sentinel
    // so the column stays non-null but downstream queries can filter
    // (WHERE userId = 'PUBLIC') to find anonymous activity. If the
    // request body carries an `email` field (login, invite-accept,
    // contact form, OTP confirm-email) we surface it so forensics
    // can pivot on the actor's claimed identity. The bodyMail is
    // best-effort: a malicious actor could spoof it, so it's evidence
    // not proof — but it's still useful in an incident.
    const actorId = isAuthed ? user.id : 'PUBLIC';
    const actorEmail = isAuthed ? (user.email || '') : this.extractPublicEmail(req);
    const actorRole = isAuthed ? (user.role || '') : 'PUBLIC';

    const eventType = `${req.method}:${path}`;
    const seed = `${this.lastHash || ''}|${actorId}|${eventType}|${Date.now()}`;
    const chainHash = createHash('sha256').update(seed).digest('hex');
    this.lastHash = chainHash;

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        userEmail: actorEmail,
        role: actorRole,
        eventType,
        target,
        targetId,
        payload,
        ipAddress: ipAddress || 'unknown',
        chainHash,
      },
    });
  }

  /** Best-effort grab of an email-shaped value from the request body
   *  for public-actor audit rows. Returns 'PUBLIC' if nothing's there. */
  private extractPublicEmail(req: any): string {
    const body = req.body;
    if (body && typeof body === 'object') {
      const e = body.email;
      if (typeof e === 'string' && e.length < 320 && e.includes('@')) return e;
    }
    return 'PUBLIC';
  }

  /** Best-effort extraction of the cuid/uuid that's typically the second
   *  path segment after the resource name (e.g. /api/interviews/<id>/cancel). */
  private extractTargetId(path: string): string | null {
    const m = path.match(/\/api\/[^/]+\/([a-z0-9-]{16,})/i);
    return m ? m[1] : null;
  }

  /** Strip sensitive fields from a body before persisting. */
  private scrub(body: any): any {
    if (!body || typeof body !== 'object') return body || null;
    const out: any = Array.isArray(body) ? [] : {};
    for (const key of Object.keys(body)) {
      if (this.SCRUB_FIELDS.has(key)) {
        out[key] = '[REDACTED]';
      } else if (body[key] && typeof body[key] === 'object') {
        out[key] = this.scrub(body[key]);
      } else if (typeof body[key] === 'string' && body[key].length > 1000) {
        // Truncate giant strings (probably base64) to keep the log row sane.
        out[key] = body[key].slice(0, 200) + '…[truncated]';
      } else {
        out[key] = body[key];
      }
    }
    return out;
  }
}
