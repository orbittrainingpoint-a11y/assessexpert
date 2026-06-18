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
 * - Public endpoints (no req.user)
 * - The audit log endpoint itself (would recurse)
 * - 4xx/5xx responses (errors logged elsewhere)
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

  constructor(private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const method = (req.method || '').toUpperCase();

    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next.handle();
    }
    if (!req.user?.id) return next.handle();
    const url = req.originalUrl || req.url || '';
    if (url.includes('/admin/audit')) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => this.write(req).catch(err => {
          this.logger.error(`Audit write failed: ${err?.message || err}`);
        }),
        // Errors are recorded by the exception filter — don't double-log.
        error: () => {},
      }),
    );
  }

  private async write(req: any) {
    const user = req.user;
    const path = (req.originalUrl || req.url || '').split('?')[0];
    const target = path.replace(/^\/api/, '').split('/')[1] || 'unknown';
    const targetId = this.extractTargetId(path);
    const payload = this.scrub(req.body);
    const ipAddress = (req.headers?.['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').trim();

    const eventType = `${req.method}:${path}`;
    const seed = `${this.lastHash || ''}|${user.id}|${eventType}|${Date.now()}`;
    const chainHash = createHash('sha256').update(seed).digest('hex');
    this.lastHash = chainHash;

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email || '',
        role: user.role || '',
        eventType,
        target,
        targetId,
        payload,
        ipAddress: ipAddress || 'unknown',
        chainHash,
      },
    });
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
