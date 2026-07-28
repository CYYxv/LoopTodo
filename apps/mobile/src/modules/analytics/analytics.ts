export type AnalyticsEvent =
  | 'task_create'
  | 'focus_start'
  | 'focus_complete'
  | 'focus_fail'
  | 'lock_start'
  | 'lock_emergency_exit'
  | 'star_settle'
  | 'tier_promote'
  | 'family_task_assign'
  | 'family_anomaly'
  | 'forced_trigger_schedule'
  | 'nav_customize'
  | 'social_pk_create'
  | 'social_report'
  | 'rank_view'
  | 'whitelist_list_created'
  | 'whitelist_list_updated'
  | 'whitelist_list_deleted'
  | 'whitelist_picker_opened'
  | 'whitelist_saved'
  | 'whitelist_permission_result'
  | 'focus_restriction_start'
  | 'app_blocked'
  | 'whitelist_blocker_shown'
  | 'whitelist_blocker_refocused'
  | 'focus_restriction_clear'
  | 'focus_restriction_recovered'
  | 'whitelist_star_settled';

export type AnalyticsEntry = {
  event: AnalyticsEvent;
  props?: Record<string, unknown>;
  at: number;
};

const RING_SIZE = 100;
const ring: AnalyticsEntry[] = [];

/** Local-only analytics sink (no network). Keeps last 100 events for tests/debug. */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  ring.push({ event, props: sanitizeProps(event, props), at: Date.now() });
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

const forbiddenSoftwareFields = new Set([
  'appcategory',
  'appname',
  'allowedpackages',
  'packagename',
  'packages',
  'riskycount',
  'softwarename',
]);

const whitelistPropertyAllowlist: Partial<Record<AnalyticsEvent, ReadonlySet<string>>> = {
  whitelist_list_created: new Set(['listId', 'selectedCount']),
  whitelist_list_updated: new Set(['listId', 'selectedCount', 'isDefault']),
  whitelist_list_deleted: new Set(['listId', 'affectedTaskCount']),
  whitelist_picker_opened: new Set(['source', 'listId', 'selectedCount']),
  whitelist_saved: new Set(['source', 'listId', 'selectedCount']),
  whitelist_permission_result: new Set(['usageAccessGranted', 'overlayGranted', 'backgroundPopupAllowed', 'deviceBrand']),
  focus_restriction_start: new Set(['mode', 'source', 'listId', 'packageCount', 'effective']),
  app_blocked: new Set(['sessionId']),
  whitelist_blocker_shown: new Set(['detectionDelayMs', 'autoReturn']),
  whitelist_blocker_refocused: new Set(['source', 'sessionId']),
  focus_restriction_clear: new Set(['reason', 'success']),
  focus_restriction_recovered: new Set(['activeSessionFound', 'nativeStateFound', 'action']),
  whitelist_star_settled: new Set(['effectiveMinutes', 'stars']),
};

function sanitizeProps(event: AnalyticsEvent, props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const allowlist = whitelistPropertyAllowlist[event];
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => allowlist
      ? allowlist.has(key)
      : !forbiddenSoftwareFields.has(key.toLocaleLowerCase())),
  );
}
