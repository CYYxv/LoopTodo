import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AUTH_RATE_LIMITER, type AuthRateLimiter } from '../src/auth/auth-rate-limiter';
import { AUTH_REPOSITORY, type AuthRepository } from '../src/auth/auth.repository';
import { AuthModule } from '../src/auth/auth.module';
import type { AuthUser, DeviceSession } from '../src/auth/auth.types';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/api-response.interceptor';

class MemoryAuthRepository implements AuthRepository {
  users = new Map<string, AuthUser>();
  sessions = new Map<string, DeviceSession>();

  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async createUserWithSession(input: Parameters<AuthRepository['createUserWithSession']>[0]) {
    const user: AuthUser = { ...input.user, vipStatus: 'free', privacySettings: {}, multiDeviceFocusSync: false };
    this.users.set(user.id, user);
    this.sessions.set(input.session.id, { ...input.session, userId: user.id, revokedAt: null });
    return user;
  }
  async createSession(input: Parameters<AuthRepository['createSession']>[0]) {
    this.sessions.set(input.id, { ...input, revokedAt: null });
  }
  async findSession(id: string) { return this.sessions.get(id) ?? null; }
  async rotateSession(id: string, currentHash: string, nextHash: string, expiresAt: Date) {
    const session = this.sessions.get(id);
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.refreshTokenHash !== currentHash) return false;
    this.sessions.set(id, { ...session, refreshTokenHash: nextHash, expiresAt });
    return true;
  }
  async revokeSession(id: string, userId: string) {
    const session = this.sessions.get(id);
    if (session?.userId === userId) this.sessions.set(id, { ...session, revokedAt: new Date() });
  }
}

describe('auth API', () => {
  let app: NestFastifyApplication;
  const repository = new MemoryAuthRepository();
  const limiter: AuthRateLimiter = { consume: async () => undefined };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            JWT_ACCESS_SECRET: 'access-secret-with-more-than-32-characters',
            JWT_REFRESH_SECRET: 'refresh-secret-with-more-than-32-characters',
            JWT_ACCESS_TTL_SECONDS: 900,
            JWT_REFRESH_TTL_SECONDS: 2592000,
          })],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(AUTH_REPOSITORY).useValue(repository)
      .overrideProvider(AUTH_RATE_LIMITER).useValue(limiter)
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => app.close());

  test('registers, authenticates, rotates refresh and revokes the device session', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'User@Example.com', password: 'strong-password', deviceName: 'Pixel' },
    });
    expect(register.statusCode).toBe(201);
    const registered = register.json().data;
    expect(registered.user.email).toBe('user@example.com');
    expect(registered.user.passwordHash).toBeUndefined();

    const duplicate = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'user@example.com', password: 'strong-password', deviceName: 'Other' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('EMAIL_EXISTS');

    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${registered.tokens.accessToken}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.email).toBe('user@example.com');

    const refresh = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: registered.tokens.refreshToken } });
    expect(refresh.statusCode).toBe(201);
    const rotated = refresh.json().data.tokens;
    const replay = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: registered.tokens.refreshToken } });
    expect(replay.statusCode).toBe(401);

    const logout = await app.inject({ method: 'POST', url: '/auth/logout', headers: { authorization: `Bearer ${rotated.accessToken}` } });
    expect(logout.statusCode).toBe(201);
    const afterLogout = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: rotated.refreshToken } });
    expect(afterLogout.statusCode).toBe(401);
  });

  test('returns one generic error for an invalid login', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'user@example.com', password: 'wrong', deviceName: 'Pixel' } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
  });
});
