import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenGuard } from './access-token.guard';
import { AUTH_RATE_LIMITER } from './auth-rate-limiter';
import { AUTH_REPOSITORY } from './auth.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PrismaAuthRepository } from './prisma-auth.repository';
import { RedisAuthRateLimiter } from './redis-auth-rate-limiter';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AccessTokenGuard,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: AUTH_RATE_LIMITER, useClass: RedisAuthRateLimiter },
  ],
})
export class AuthModule {}
