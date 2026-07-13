import { HttpStatus } from '@nestjs/common';

import { ApiError } from '../common/api-error';
import { MemoryAuthRateLimiter } from './memory-auth-rate-limiter';

describe('MemoryAuthRateLimiter', () => {
  test('allows ten requests and rejects the eleventh', async () => {
    const limiter = new MemoryAuthRateLimiter();
    for (let index = 0; index < 10; index += 1) {
      await expect(limiter.consume('register', 'user@example.com')).resolves.toBeUndefined();
    }
    try {
      await limiter.consume('register', 'user@example.com');
      throw new Error('Expected limiter to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
