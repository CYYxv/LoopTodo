export type AuthNavigationStatus = 'hydrating' | 'signed_out' | 'signed_in';

export function rootRedirect(
  status: AuthNavigationStatus,
  firstSegment: string | undefined,
  hasActiveSession: boolean,
) {
  if (status === 'signed_out' && firstSegment !== 'login') return '/login' as const;
  if (status === 'signed_in' && hasActiveSession && firstSegment !== 'session') return '/session' as const;
  if (status === 'signed_in' && firstSegment === 'login') return '/tasks' as const;
  return null;
}
