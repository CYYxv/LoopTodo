import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { TokenService } from './token.service';

describe('TokenService', () => {
  const config = new ConfigService({
    JWT_ACCESS_SECRET: 'access-secret-with-more-than-32-characters',
    JWT_REFRESH_SECRET: 'refresh-secret-with-more-than-32-characters',
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 2592000,
  });
  const service = new TokenService(new JwtService(), config);

  test('separates access and refresh token types', async () => {
    const tokens = await service.issue('user-id', 'session-id');
    await expect(service.verifyAccess(tokens.accessToken)).resolves.toMatchObject({ type: 'access' });
    await expect(service.verifyRefresh(tokens.refreshToken)).resolves.toMatchObject({ type: 'refresh' });
    await expect(service.verifyAccess(tokens.refreshToken)).rejects.toBeTruthy();
  });

  test('hashes refresh tokens without storing the token', () => {
    expect(service.hashRefreshToken('refresh-token')).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hashRefreshToken('refresh-token')).not.toContain('refresh-token');
  });
});
