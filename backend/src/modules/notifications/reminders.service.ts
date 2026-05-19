import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// We import Bull lazily inside the constructor so the package isn't
// even loaded when REDIS_URL is unset — keeps the in-memory fallback
// path light and avoids surfacing Bull's noisy connect/retry logs in
// dev. Bull is already in package.json so the require always resolves.
type BullJobData = {
  to: string;
  subject: string;
  html: string;
};

const QUEUE_NAME = 'email-reminders';

/**
 * Schedules delayed reminder emails. Persisted via Bull (Redis) when
 * REDIS_URL is set; falls back to in-process setTimeout otherwise.
 *
 * The in-process fallback is fine for single-instance dev/staging but
 * loses queued jobs if the process restarts — that's the whole reason
 * the Bull path exists. In production with REDIS_URL set, scheduled
 * reminders survive deploys and the worker resumes after restart.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private queue: any = null;

  constructor(private notifications: NotificationsService) {}

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.log('REDIS_URL not set — reminders use in-process setTimeout');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Bull = require('bull');
      this.queue = new Bull(QUEUE_NAME, url, {
        defaultJobOptions: {
          // Drop completed jobs eagerly — reminder records aren't
          // interesting after delivery, and otherwise they pile up.
          removeOnComplete: true,
          // Keep failed jobs for a week so we can diagnose delivery
          // problems but don't grow unbounded.
          removeOnFail: { age: 7 * 24 * 60 * 60 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      });
      this.queue.process(async (job: { data: BullJobData }) => {
        await this.notifications.sendEmail(job.data.to, job.data.subject, job.data.html);
      });
      this.queue.on('failed', (job: any, err: Error) => {
        this.logger.warn(`Reminder ${job?.id} failed: ${err.message}`);
      });
      this.logger.log(`Bull queue "${QUEUE_NAME}" connected (Redis)`);
    } catch (e) {
      this.logger.warn(`Bull init failed (${(e as Error).message}); using setTimeout`);
      this.queue = null;
    }
  }

  async onModuleDestroy() {
    if (this.queue) {
      try { await this.queue.close(); } catch {}
      this.queue = null;
    }
  }

  /**
   * Schedule a reminder email to be sent at the given absolute time.
   * Jobs scheduled in the past are dropped silently — the scheduling
   * service already gates this on `> now` for the bull path, but we
   * double-check here so callers can't accidentally fire historical
   * reminders during data backfills.
   */
  async schedule(at: Date, payload: BullJobData): Promise<void> {
    const delayMs = at.getTime() - Date.now();
    if (delayMs <= 0) return;

    if (this.queue) {
      try {
        await this.queue.add(payload, { delay: delayMs });
        return;
      } catch (e) {
        this.logger.warn(`queue.add failed (${(e as Error).message}); falling back to setTimeout`);
      }
    }

    // In-process fallback. Lost on restart — that's the trade-off.
    setTimeout(() => {
      this.notifications
        .sendEmail(payload.to, payload.subject, payload.html)
        .catch(err => this.logger.warn(`In-process reminder failed: ${err.message}`));
    }, delayMs);
  }
}
