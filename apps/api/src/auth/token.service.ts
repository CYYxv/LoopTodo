import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { TokenClaims, TokenPair } from './auth.types';

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(private readonly jwt: JwtService, config: ConfigService) {
    this.accessSecret = config.getOrThrow('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow('JWT_REFRESH_SECRET');
    this.accessTtl = Number(config.getOrThrow('JWT_ACCESS_TTL_SECONDS'));
    this.refreshTtl = Number(config.getOrThrow('JWT_REFRESH_TTL_SECONDS'));
  }

  async issue(userId: string, sessionId: string): Promise<TokenPair> {
    const accessClaims: TokenClaims = { sub: userId, sessionId, type: 'access', jti: randomUUID() };
    const refreshClaims: TokenClaims = { sub: userId, sessionId, type: 'refresh', jti: randomUUID() };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessClaims, { secret: this.accessSecret, expiresIn: this.accessTtl }),
      this.jwt.signAsync(refreshClaims, { secret: this.refreshSecret, expiresIn: this.refreshTtl }),
    ]);
    return { accessToken, refreshToken, expiresIn: this.accessTtl };
  }

  async verifyAccess(token: string) {
    const claims = await this.jwt.verifyAsync<TokenClaims>(token, { secret: this.accessSecret });
    if (claims.type !== 'access') throw new Error('Invalid access token type');
    return claims;
  }

  async verifyRefresh(token: string) {
    const claims = await this.jwt.verifyAsync<TokenClaims>(token, { secret: this.refreshSecret });
    if (claims.type !== 'refresh') throw new Error('Invalid refresh token type');
    return claims;
  }

  hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshExpiresAt(now = Date.now()) {
    return new Date(now + this.refreshTtl * 1000);
  }
}
