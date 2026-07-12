export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  vipStatus: 'free' | 'active' | 'expired';
  privacySettings: unknown;
  multiDeviceFocusSync: boolean;
  socialEnabled: boolean; shareCurrentTask: boolean; shareCompletedTasks: boolean;
  networkPolicy: 'offline_first' | 'online_required';
  taskRemindersEnabled: boolean; familyAlertsEnabled: boolean; rewardNotificationsEnabled: boolean;
};

export type PublicUser = Omit<AuthUser, 'passwordHash'>;

export type DeviceSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type TokenClaims = {
  sub: string;
  sessionId: string;
  type: 'access' | 'refresh';
  jti: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export function publicUser(user: AuthUser): PublicUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
