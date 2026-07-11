import type { NotificationRepository } from './notification.repository';
import { NotificationService, NotificationWorker, retryDelay } from './notification.service';
import type { DeliveryJob, NotificationEventInput } from './notification.types';
import type { PushProvider } from './push-provider';

function repository(jobs: DeliveryJob[] = []) {
  const retries: Array<{ id: string; attempts: number; at: Date }> = [];
  const failed: Array<{ id: string; attempts: number; error: string }> = [];
  const delivered: string[] = []; const disabled: string[] = [];
  const events = new Map<string, { id: string; deliveries: number }>();
  const devices = [{ id: 'device-1' }, { id: 'device-2' }];
  const value: NotificationRepository = {
    async upsertDevice() { return { id: 'device-1' }; },
    async enqueue(input: NotificationEventInput) {
      const previous = events.get(input.dedupeKey);
      if (previous) return { eventId: previous.id, deliveries: previous.deliveries, replayed: true };
      const event = { id: `event-${events.size + 1}`, deliveries: devices.length }; events.set(input.dedupeKey, event);
      return { eventId: event.id, deliveries: event.deliveries, replayed: false };
    },
    async claimDue() { return jobs; }, async markDelivered(id) { delivered.push(id); },
    async scheduleRetry(id, attempts, at) { retries.push({ id, attempts, at }); },
    async markFailed(id, attempts, error) { failed.push({ id, attempts, error }); },
    async disableDevice(id) { disabled.push(id); },
  };
  return { value, retries, failed, delivered, disabled };
}

const event: NotificationEventInput = { userId: 'user', type: 'focus_complete', title: 'done', body: 'body', data: {}, dedupeKey: 'same', scheduledAt: new Date(0) };
const job = (overrides: Partial<DeliveryJob> = {}): DeliveryJob => ({ id: 'delivery', eventId: 'event', deviceId: 'device-1', attempts: 0,
  provider: 'test', pushToken: 'token', title: 'title', body: 'body', data: {}, ...overrides });

describe('notification delivery', () => {
  test('deduplicates events and fans out to active devices', async () => {
    const state = repository(); const service = new NotificationService(state.value);
    expect(await service.enqueue(event)).toEqual({ eventId: 'event-1', deliveries: 2, replayed: false });
    expect(await service.enqueue(event)).toEqual({ eventId: 'event-1', deliveries: 2, replayed: true });
  });

  test('isolates provider failures and retries exponentially', async () => {
    jest.useFakeTimers().setSystemTime(new Date(1000));
    const state = repository([job({ id: 'bad' }), job({ id: 'good', deviceId: 'device-2' })]);
    const provider: PushProvider = { name: 'test', async send(item) { if (item.id === 'bad') throw new Error('offline'); return { providerId: 'ok' }; } };
    await new NotificationWorker(state.value, [provider]).processDue();
    expect(state.delivered).toEqual(['good']);
    expect(state.retries[0]).toEqual({ id: 'bad', attempts: 1, at: new Date(1000 + retryDelay(1)) });
    jest.useRealTimers();
  });

  test('stops at eight attempts and disables invalid tokens', async () => {
    const state = repository([job({ id: 'limit', attempts: 7 }), job({ id: 'invalid', deviceId: 'device-2' })]);
    const provider: PushProvider = { name: 'test', async send(item) { if (item.id === 'invalid') return { invalidToken: true }; throw new Error('still offline'); } };
    await new NotificationWorker(state.value, [provider]).processDue();
    expect(state.failed).toEqual(expect.arrayContaining([
      { id: 'limit', attempts: 8, error: 'still offline' },
      { id: 'invalid', attempts: 1, error: 'INVALID_PUSH_TOKEN' },
    ]));
    expect(state.disabled).toEqual(['device-2']);
  });
});
