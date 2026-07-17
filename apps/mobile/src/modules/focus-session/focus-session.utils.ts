import type { ActiveSession } from './focus-session.types';

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function sessionElapsedMilliseconds(session: ActiveSession, now: number) {
  const effectiveNow = session.pausedAt ?? now;
  return Math.max(0, effectiveNow - session.startedAt - (session.accumulatedPausedMs ?? 0));
}

export function sessionTimerSeconds(session: ActiveSession, now: number) {
  if (session.phase === 'rest') return Math.max(0, Math.ceil(((session.restEndsAt ?? now) - now) / 1000));
  if (session.timerMode === 'untimed') return null;
  if (session.timerMode === 'countup') return Math.floor(sessionElapsedMilliseconds(session, now) / 1000);
  const effectiveNow = session.pausedAt ?? now;
  return Math.max(0, Math.ceil(((session.plannedEndAt ?? effectiveNow) - effectiveNow) / 1000));
}
