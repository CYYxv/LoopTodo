import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';

import { NOTIFICATION_REPOSITORY, type NotificationRepository } from './notification.repository';
import { PUSH_PROVIDERS, type PushProvider } from './push-provider';
import type { NotificationEventInput } from './notification.types';

@Injectable()
export class NotificationService {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository) {}
  registerDevice(userId: string, input: Omit<Parameters<NotificationRepository['upsertDevice']>[0], 'userId'>) { return this.repository.upsertDevice({ userId, ...input }); }
  enqueue(input: NotificationEventInput) { return this.repository.enqueue(input); }
}

@Injectable()
export class NotificationWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository,
    @Inject(PUSH_PROVIDERS) providers: PushProvider[]) {
    this.providers = new Map(providers.map((provider) => [provider.name, provider]));
  }
  private readonly providers: Map<string, PushProvider>;
  private readonly logger = new Logger(NotificationWorker.name);
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  onApplicationBootstrap() {
    this.interval = setInterval(() => {
      void this.processDue().catch((error: unknown) => this.logger.error('Notification delivery batch failed', error));
    }, 15_000);
    this.interval.unref?.();
  }
  onApplicationShutdown() { if (this.interval) clearInterval(this.interval); }
  async processDue(limit = 100) {
    if (this.running) return { processed: 0 };
    this.running = true;
    try {
    const jobs = await this.repository.claimDue(new Date(), limit);
    await Promise.all(jobs.map(async (job) => {
      const attempts = job.attempts + 1;
      try {
        const provider = this.providers.get(job.provider);
        if (!provider) throw new Error(`Push provider ${job.provider} is not registered`);
        const result = await provider.send(job);
        if ('invalidToken' in result) {
          await this.repository.disableDevice(job.deviceId);
          await this.repository.markFailed(job.id, attempts, 'INVALID_PUSH_TOKEN');
        } else await this.repository.markDelivered(job.id, result.providerId, new Date());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'push delivery failed';
        if (attempts >= 8) await this.repository.markFailed(job.id, attempts, message);
        else await this.repository.scheduleRetry(job.id, attempts, new Date(Date.now() + retryDelay(attempts)), message);
      }
    }));
    return { processed: jobs.length };
    } finally { this.running = false; }
  }
}

export function retryDelay(attempts: number) { return Math.min(60 * 60 * 1000, 5000 * 2 ** (attempts - 1)); }
