import { HttpStatus, Injectable } from '@nestjs/common';

import { ApiError } from '../common/api-error';
import { RedisService } from '../infrastructure/redis/redis.service';

import type { AuthRateLimiter } from './auth-rate-limiter';

@Injectable()
export class RedisAuthRateLimiter implements AuthRateLimiter {
  constructor(private readonly redis: RedisService) {}

  async consume(action: 'register' | 'login', identity: string) {
    try {
      const client = await this.redis.getClient();
      const key = `auth:${action}:${identity}`;
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, 60);
      if (count > 10) throw new ApiError('AUTH_RATE_LIMITED', '请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('AUTH_RATE_LIMIT_UNAVAILABLE', '认证保护服务暂不可用', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
