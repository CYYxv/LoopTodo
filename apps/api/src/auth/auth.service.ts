import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { AUTH_RATE_LIMITER, type AuthRateLimiter } from './auth-rate-limiter';
import { AUTH_REPOSITORY, EmailAlreadyExistsError, type AuthRepository } from './auth.repository';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { RegisterDto } from './dto/register.dto';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { publicUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(AUTH_RATE_LIMITER) private readonly rateLimiter: AuthRateLimiter,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService
  ) {}

  async register(input: RegisterDto) {
    const email = normalizeEmail(input.email);
    await this.rateLimiter.consume('register', email);
    if (await this.repository.findUserByEmail(email)) throw new ConflictException({ code: 'EMAIL_EXISTS', message: '该邮箱已注册' });

    const userId = randomUUID();
    const sessionId = randomUUID();
    const tokenPair = await this.tokens.issue(userId, sessionId);
    let user;
    try {
      user = await this.repository.createUserWithSession({
        user: {
          id: userId,
          email,
          passwordHash: await this.passwords.hash(input.password),
          nickname: input.nickname?.trim() || email.split('@')[0] || 'LoopTodo 用户',
        },
        session: {
          id: sessionId,
          deviceName: input.deviceName.trim(),
          refreshTokenHash: this.tokens.hashRefreshToken(tokenPair.refreshToken),
          expiresAt: this.tokens.refreshExpiresAt(),
        },
      });
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) throw new ConflictException({ code: 'EMAIL_EXISTS', message: '该邮箱已注册' });
      throw error;
    }
    return { user: publicUser(user), tokens: tokenPair };
  }

  async login(input: LoginDto) {
    const email = normalizeEmail(input.email);
    await this.rateLimiter.consume('login', email);
    const user = await this.repository.findUserByEmail(email);
    if (!user || !(await this.passwords.verify(user.passwordHash, input.password))) throw invalidCredentials();

    const sessionId = randomUUID();
    const tokenPair = await this.tokens.issue(user.id, sessionId);
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      deviceName: input.deviceName.trim(),
      refreshTokenHash: this.tokens.hashRefreshToken(tokenPair.refreshToken),
      expiresAt: this.tokens.refreshExpiresAt(),
    });
    return { user: publicUser(user), tokens: tokenPair };
  }

  async refresh(input: RefreshDto) {
    let claims;
    try {
      claims = await this.tokens.verifyRefresh(input.refreshToken);
    } catch {
      throw invalidRefresh();
    }
    const nextTokens = await this.tokens.issue(claims.sub, claims.sessionId);
    const rotated = await this.repository.rotateSession(
      claims.sessionId,
      this.tokens.hashRefreshToken(input.refreshToken),
      this.tokens.hashRefreshToken(nextTokens.refreshToken),
      this.tokens.refreshExpiresAt()
    );
    if (!rotated) throw invalidRefresh();
    const user = await this.repository.findUserById(claims.sub);
    if (!user) throw invalidRefresh();
    return { user: publicUser(user), tokens: nextTokens };
  }

  async logout(userId: string, sessionId: string) {
    await this.repository.revokeSession(sessionId, userId);
    return { revoked: true };
  }

  async me(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw invalidCredentials();
    return publicUser(user);
  }

  async updateSettings(userId: string, input: UpdateSettingsDto) {
    const { themePreference, ...settings } = input;
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw invalidCredentials();
    let settingsInput: typeof settings = { ...settings };
    // Always merge over existing privacy JSON so partial patches keep themePreference etc.
    const privacy: Record<string, unknown> = {
      ...privacySettingsFrom(existing.privacySettings),
      ...privacySettingsFrom(settings.privacySettings),
      ...(themePreference !== undefined ? { themePreference } : {}),
    };
    if (settings.privacySettings !== undefined || themePreference !== undefined) {
      settingsInput = { ...settingsInput, privacySettings: privacy };
    }
    // TBD-S06: birthYear forces isMinor when age < 18; minors get stricter share defaults
    const isMinor = resolveIsMinor(privacy);
    if (settings.privacySettings !== undefined || themePreference !== undefined || isMinor) {
      const nextPrivacy = {
        ...privacy,
        ...(isMinor ? {
          isMinor: true,
          socialVisibility: privacy.socialVisibility === 'public'
            ? 'friends'
            : privacy.socialVisibility ?? 'friends',
        } : {}),
      };
      settingsInput = {
        ...settingsInput,
        ...(isMinor ? { shareCurrentTask: false, shareCompletedTasks: false } : {}),
        privacySettings: nextPrivacy,
      };
    }
    const user = await this.repository.updateSettings(userId, settingsInput);
    if (!user) throw invalidCredentials();
    return publicUser(user);
  }
}

function privacySettingsFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function resolveIsMinor(privacy: Record<string, unknown>): boolean {
  const birthYear = Number(privacy.birthYear);
  if (Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= new Date().getUTCFullYear()) {
    const age = new Date().getUTCFullYear() - birthYear;
    if (age < 18) return true;
  }
  return privacy.isMinor === true;
}

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function invalidCredentials() { return new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' }); }
function invalidRefresh() { return new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: '刷新凭证无效或已失效' }); }
