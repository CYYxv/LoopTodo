export type AnalyticsEvent =
  | 'task_create'
  | 'focus_start'
  | 'focus_complete'
  | 'focus_fail'
  | 'lock_start'
  | 'lock_emergency_exit'
  | 'family_task_assign'
  | 'nav_customize'
  | 'social_pk_create'
  | 'social_report';

export type AnalyticsEntry = {
  event: AnalyticsEvent;
  props?: Record<string, unknown>;
  at: number;
};

const RING_SIZE = 100;
const ring: AnalyticsEntry[] = [];

/** Local-only analytics sink (no network). Keeps last 100 events for tests/debug. */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  ring.push({ event, props, at: Date.now() });
  if (ring.length > RING_SIZE) {
    ring.splice(0, ring.length - RING_SIZE);
  }
}

export function getAnalyticsEvents(): readonly AnalyticsEntry[] {
  return ring;
}

export function clearAnalyticsEvents(): void {
  ring.length = 0;
}
