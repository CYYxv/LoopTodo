import type { DeliveryJob, PushProviderName, PushResult } from './notification.types';

export const PUSH_PROVIDERS = Symbol('PUSH_PROVIDERS');
export interface PushProvider { readonly name: PushProviderName; send(job: DeliveryJob): Promise<PushResult>; }
