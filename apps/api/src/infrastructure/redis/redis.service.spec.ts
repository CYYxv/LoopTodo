import { DevelopmentMemoryRedis } from './redis.service';

describe('development Redis fallback', () => {
  test('supports cache expiry and NX rate limits', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const redis = new DevelopmentMemoryRedis();
    await expect(redis.set('reaction:user', '1', 'EX', 1, 'NX')).resolves.toBe('OK');
    await expect(redis.set('reaction:user', '1', 'EX', 1, 'NX')).resolves.toBeNull();
    jest.spyOn(Date, 'now').mockReturnValue(2_001);
    await expect(redis.set('reaction:user', '1', 'EX', 1, 'NX')).resolves.toBe('OK');
    jest.restoreAllMocks();
  });

  test('supports counters used by invite and auth limits', async () => {
    const redis = new DevelopmentMemoryRedis();
    await expect(redis.incr('family:user')).resolves.toBe(1);
    await expect(redis.expire('family:user', 300)).resolves.toBe(1);
    await expect(redis.incr('family:user')).resolves.toBe(2);
  });
});
