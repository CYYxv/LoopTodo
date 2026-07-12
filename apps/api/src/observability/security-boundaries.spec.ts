import { FamilyService } from '../family/family.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { RewardService } from '../rewards/reward.service';
import { encryptAddress } from '../rewards/address.crypto';

describe('security boundaries', () => {
  test('records denied family status access without exposing the target id', async () => {
    const events: unknown[] = [];
    const prisma = { familyMember: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new FamilyService(prisma as never, {} as never, {} as never, {} as never, { record: async (input: unknown) => { events.push(input); } } as never);
    await expect(service.status('actor-id', 'child-id')).rejects.toMatchObject({ status: 403 });
    expect(events[0]).toMatchObject({ category: 'authorization', action: 'family_status_read', outcome: 'denied', targetId: 'child-id' });
  });

  test('rejects forged payment webhooks and records only identifiers and reason', async () => {
    const events: unknown[] = [];
    const prisma = {
      subscriptionOrder: { findUnique: jest.fn().mockResolvedValue(null) },
      paymentAudit: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    };
    const config = { get: (name: string) => name === 'PAYMENT_WEBHOOK_SECRET' ? 'a-secure-webhook-secret' : undefined };
    const service = new SubscriptionService(prisma as never, [], config as never, { record: async (input: unknown) => { events.push(input); } } as never);
    await expect(service.handleWebhook({ eventId: 'event-1', externalOrderId: 'external-1', status: 'paid' }, 'forged')).rejects.toMatchObject({ status: 401 });
    expect(events[0]).toMatchObject({ category: 'payment', outcome: 'denied', metadata: { eventId: 'event-1', reason: 'invalid_signature' } });
    expect(JSON.stringify(events[0])).not.toContain('forged');
  });

  test('audits reward address reads without placing plaintext in the event', async () => {
    const events: unknown[] = [];
    const secret = 'reward-address-test-secret';
    const encrypted = encryptAddress({ recipient: '张三', phone: '13800138000', address: '北京市测试路 1 号' }, secret);
    const prisma = { rewardAddress: { findUnique: jest.fn().mockResolvedValue({ id: 'address-id', ...encrypted, updatedAt: new Date() }) } };
    const config = { getOrThrow: () => secret };
    const service = new RewardService(prisma as never, config as never, {} as never, { record: async (input: unknown) => { events.push(input); } } as never);
    const result = await service.getAddress('user-id');
    expect(result?.phone).toBe('13800138000');
    expect(events[0]).toMatchObject({ category: 'privacy', action: 'reward_address_read', targetId: 'address-id' });
    expect(JSON.stringify(events[0])).not.toContain('13800138000');
  });
});
