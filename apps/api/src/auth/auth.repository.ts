import type { AuthUser, DeviceSession } from './auth.types';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export class EmailAlreadyExistsError extends Error {}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createUserWithSession(input: {
    user: { id: string; email: string; passwordHash: string; nickname: string };
    session: { id: string; deviceName: string; refreshTokenHash: string; expiresAt: Date };
  }): Promise<AuthUser>;
  createSession(input: {
    id: string;
    userId: string;
    deviceName: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findSession(id: string): Promise<DeviceSession | null>;
  rotateSession(id: string, currentHash: string, nextHash: string, expiresAt: Date): Promise<boolean>;
  revokeSession(id: string, userId: string): Promise<void>;
  updateSettings(userId: string, input: { multiDeviceFocusSync?: boolean; privacySettings?: Record<string, unknown>; socialEnabled?: boolean; shareCurrentTask?: boolean; shareCompletedTasks?: boolean; networkPolicy?: 'offline_first' | 'online_required'; taskRemindersEnabled?: boolean; familyAlertsEnabled?: boolean; rewardNotificationsEnabled?: boolean }): Promise<AuthUser | null>;
}
