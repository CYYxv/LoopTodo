import { entitlementView, extendSubscription, planPrices } from './subscription.policy';
test('keeps monthly price below fifteen yuan and defines all billing periods', () => { expect(planPrices.monthly).toBeLessThanOrEqual(1500); expect(Object.keys(planPrices)).toEqual(['monthly', 'quarterly', 'yearly']); });
test('extends subscriptions from the current expiry', () => { expect(extendSubscription(new Date('2026-01-01T00:00:00Z'), 'quarterly').toISOString()).toBe('2026-04-01T00:00:00.000Z'); });
test('free users retain core features with a three habit limit', () => { expect(entitlementView(false)).toMatchObject({ vip: false, habitLimit: 3, taskAi: false, familyManagement: false }); });
