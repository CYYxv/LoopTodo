export const AUTH_RATE_LIMITER = Symbol('AUTH_RATE_LIMITER');

export interface AuthRateLimiter {
  consume(action: 'register' | 'login', identity: string): Promise<void>;
}
