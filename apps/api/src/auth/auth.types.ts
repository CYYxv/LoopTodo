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

export type PublicUser = Omit<AuthUser, 'passwordHash'> & { themePreference: ThemePreference; isMinor: boolean };

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
  return { ...safeUser, themePreference: themePreferenceFrom(user.privacySettings), isMinor: isMinorFrom(user.privacySettings) };
}

function isMinorFrom(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const privacy = value as Record<string, unknown>;
  const birthYear = Number(privacy.birthYear);
  if (Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= new Date().getUTCFullYear()) {
    if (new Date().getUTCFullYear() - birthYear < 18) return true;
  }
  return privacy.isMinor === true;
}

function themePreferenceFrom(value: unknown): ThemePreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'system';
  const themePreference = (value as Record<string, unknown>).themePreference;
  return themePreference === 'light' || themePreference === 'dark' ? themePreference : 'system';
}
