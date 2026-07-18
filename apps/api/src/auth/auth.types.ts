export type BottomTabKey = 'habits' | 'statistics' | 'social';
export type ThemePreference = 'system' | 'light' | 'dark';

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  vipStatus: 'free' | 'active' | 'expired';
  privacySettings: unknown;
  multiDeviceFocusSync: boolean;
  bottomTabs: BottomTabKey[];
  shareCurrentTask: boolean; shareCompletedTasks: boolean;
  networkPolicy: 'offline_first' | 'online_required';
  taskRemindersEnabled: boolean; familyAlertsEnabled: boolean; rewardNotificationsEnabled: boolean;
};

export type PublicUser = Omit<AuthUser, 'passwordHash'> & { themePreference: ThemePreference };

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
  return { ...safeUser, themePreference: themePreferenceFrom(user.privacySettings) };
}

function themePreferenceFrom(value: unknown): ThemePreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'system';
  const themePreference = (value as Record<string, unknown>).themePreference;
  return themePreference === 'light' || themePreference === 'dark' ? themePreference : 'system';
}
