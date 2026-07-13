import { HttpStatus, Injectable } from '@nestjs/common';

import { ApiError } from '../common/api-error';
import type { AuthRateLimiter } from './auth-rate-limiter';

@Injectable()
export class MemoryAuthRateLimiter implements AuthRateLimiter {
  private readonly windows = new Map<string, { count: number; expiresAt: number }>();

  async consume(action: 'register' | 'login', identity: string) {
    const key = `${action}:${identity}`;
    const now = Date.now();
    const current = this.windows.get(key);
    const window = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + 60_000 }
      : { count: current.count + 1, expiresAt: current.expiresAt };
    this.windows.set(key, window);
    if (window.count > 10) {
      throw new ApiError('AUTH_RATE_LIMITED', '请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
