import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PushProvider } from './push-provider';
import type { DeliveryJob, PushProviderName, PushResult } from './notification.types';

abstract class HttpPushProvider implements PushProvider {
  abstract readonly name: PushProviderName;
  protected abstract endpoint(): string | undefined;
  protected abstract token(): string | undefined;
  protected payload(job: DeliveryJob): unknown { return { token: job.pushToken, notification: { title: job.title, body: job.body }, data: job.data }; }
  async send(job: DeliveryJob): Promise<PushResult> {
    const endpoint = this.endpoint(); const token = this.token();
    if (!endpoint || !token) throw new Error(`${this.name.toUpperCase()} push credentials are not configured`);
    const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(this.payload(job)) });
    if (response.status === 404 || response.status === 410) return { invalidToken: true };
    if (!response.ok) throw new Error(`${this.name} push failed with ${response.status}`);
    const result = await response.json() as { name?: string; id?: string };
    return { providerId: result.name ?? result.id ?? `${this.name}-${job.id}` };
  }
}

@Injectable()
export class FcmPushProvider extends HttpPushProvider {
  readonly name = 'fcm' as const;
  constructor(private readonly config: ConfigService) { super(); }
  protected endpoint() { return this.config.get<string>('FCM_HTTP_ENDPOINT'); }
  protected token() { return this.config.get<string>('FCM_ACCESS_TOKEN'); }
  protected payload(job: DeliveryJob): unknown { return { message: { token: job.pushToken, notification: { title: job.title, body: job.body }, data: job.data } }; }
}

@Injectable()
export class VendorPushProvider extends HttpPushProvider {
  readonly name = 'vendor' as const;
  constructor(private readonly config: ConfigService) { super(); }
  protected endpoint() { return this.config.get<string>('VENDOR_PUSH_ENDPOINT'); }
  protected token() { return this.config.get<string>('VENDOR_PUSH_TOKEN'); }
}

@Injectable()
export class TestPushProvider implements PushProvider {
  readonly name = 'test' as const;
  async send(job: DeliveryJob) { return { providerId: `test-${job.id}` }; }
}
