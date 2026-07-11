import { HttpStatus } from '@nestjs/common';

import { ApiError } from '../common/api-error';
import type { RedisService } from '../infrastructure/redis/redis.service';
import { RedisAuthRateLimiter } from './redis-auth-rate-limiter';

describe('RedisAuthRateLimiter', () => {
  test('fails closed when Redis is unavailable', async () => {
    const redis = { getClient: async () => { throw new Error('offline'); } } as unknown as RedisService;
    const limiter = new RedisAuthRateLimiter(redis);

    await expectStatus(limiter.consume('login', 'user@example.com'), HttpStatus.SERVICE_UNAVAILABLE);
  });

  test('rejects the eleventh request in the window', async () => {
    const client = { incr: async () => 11, expire: async () => 1 };
    const redis = { getClient: async () => client } as unknown as RedisService;
    const limiter = new RedisAuthRateLimiter(redis);

    await expectStatus(limiter.consume('login', 'user@example.com'), HttpStatus.TOO_MANY_REQUESTS);
  });
});

async function expectStatus(promise: Promise<void>, status: HttpStatus) {
  try {
    await promise;
    throw new Error('Expected limiter to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).getStatus()).toBe(status);
  }
}
