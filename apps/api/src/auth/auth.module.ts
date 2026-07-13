import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from '../infrastructure/redis/redis.module';

import { AccessTokenGuard } from './access-token.guard';
import { AUTH_RATE_LIMITER } from './auth-rate-limiter';
import { AUTH_REPOSITORY } from './auth.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PrismaAuthRepository } from './prisma-auth.repository';
import { RedisAuthRateLimiter } from './redis-auth-rate-limiter';
import { MemoryAuthRateLimiter } from './memory-auth-rate-limiter';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({}), RedisModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AccessTokenGuard,
    RedisAuthRateLimiter,
    MemoryAuthRateLimiter,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    {
      provide: AUTH_RATE_LIMITER,
      inject: [ConfigService, RedisAuthRateLimiter, MemoryAuthRateLimiter],
      useFactory: (config: ConfigService, redis: RedisAuthRateLimiter, memory: MemoryAuthRateLimiter) =>
        config.get<string>('NODE_ENV') === 'development' ? memory : redis,
    },
  ],
  exports: [AccessTokenGuard, TokenService],
})
export class AuthModule {}
