import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Upload-size audit interceptor. AUDIT-ONLY — does NOT reject anything.
 *
 * We want to know how big the real-world uploads are before locking down a
 * mime allowlist + max-bytes ceiling (S8 in SECURITY.md). For a week, this
 * just emits structured WARN log lines when a request body exceeds the
 * suggested ceilings. Tail the log, see what's actually hitting which
 * endpoint, then we can safely enforce limits in the next sprint.
 *
 * Logged at WARN so it's visible in pm2 logs without being noisy on
 * normal traffic. No external dependency.
 */
@Injectable()
export class UploadAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('UploadAudit');

  // Suggested ceilings — chosen conservatively so the WARN line surfaces
  // anything worth knowing about. Tighten in a follow-up commit.
  private readonly THRESHOLDS = {
    image: 5 * 1024 * 1024,      // 5 MB
    pdf: 10 * 1024 * 1024,       // 10 MB
    video: 50 * 1024 * 1024,     // 50 MB (recording chunks)
    other: 5 * 1024 * 1024,      // 5 MB default
  };

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const contentLengthHeader = req.headers?.['content-length'];
    const contentType = (req.headers?.['content-type'] || '').toString();

    // Only audit multipart / large JSON bodies. Most app traffic is small
    // JSON — no need to log every request.
    const isUpload = contentType.startsWith('multipart/') || (
      contentType.startsWith('application/json') &&
      contentLengthHeader && Number(contentLengthHeader) > this.THRESHOLDS.image
    );
    if (!isUpload || !contentLengthHeader) return next.handle();

    const length = Number(contentLengthHeader);
    if (!Number.isFinite(length) || length <= 0) return next.handle();

    let category: keyof typeof this.THRESHOLDS = 'other';
    if (contentType.includes('image/')) category = 'image';
    else if (contentType.includes('pdf')) category = 'pdf';
    else if (contentType.includes('video/') || contentType.includes('webm')) category = 'video';

    const ceiling = this.THRESHOLDS[category];
    if (length > ceiling) {
      const user = req.user;
      this.logger.warn(
        `OVERSIZED ${category} upload: ${(length / 1024 / 1024).toFixed(2)} MB ` +
        `(ceiling ${(ceiling / 1024 / 1024).toFixed(0)} MB) → ${req.method} ${req.originalUrl || req.url} ` +
        `user=${user?.id || 'public'} org=${user?.organizationId || '-'}`,
      );
    }

    return next.handle();
  }
}
