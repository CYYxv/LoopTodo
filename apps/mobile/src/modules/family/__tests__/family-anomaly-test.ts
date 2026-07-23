import {
  collectFamilyAnomalies,
  forcedTriggerAt,
  isPermissionAnomaly,
  missedForcedTriggerTasks,
  overdueMustDoTasks,
  type FamilyAnomalyType,
} from '../family-anomaly';

test('detects missing lock permissions as permission anomaly', () => {
  expect(isPermissionAnomaly({
    accessibilityEnabled: true,
    notificationGranted: true,
    notificationListenerEnabled: true,
    batteryOptimizationIgnored: true,
  })).toBe(false);
  expect(isPermissionAnomaly({
    accessibilityEnabled: false,
    notificationGranted: true,
    notificationListenerEnabled: true,
    batteryOptimizationIgnored: true,
  })).toBe(true);
  expect(isPermissionAnomaly({
    accessibilityEnabled: true,
    notificationGranted: true,
    notificationListenerEnabled: false,
    batteryOptimizationIgnored: true,
  })).toBe(true);
});

test('lists overdue must-do tasks by forced trigger time', () => {
  const now = Date.parse('2026-07-23T21:30:00');
  const tasks = [
    { id: 'a', mustDo: true, forcedTriggerTime: '20:00', deadlineAt: null, status: 'pending' },
    { id: 'b', mustDo: true, forcedTriggerTime: '22:00', deadlineAt: null, status: 'pending' },
    { id: 'c', mustDo: false, forcedTriggerTime: '19:00', deadlineAt: now - 1, status: 'pending' },
    { id: 'd', mustDo: true, forcedTriggerTime: '19:00', deadlineAt: null, status: 'completed' },
    { id: 'e', mustDo: true, forcedTriggerTime: null, deadlineAt: now - 5, status: 'failed' },
  ] as any;
  expect(overdueMustDoTasks(tasks, now).map((task) => task.id).sort()).toEqual(['a', 'e']);
  expect(missedForcedTriggerTasks(tasks, now).map((task) => task.id)).toEqual(['a']);
});

test('collectFamilyAnomalies merges permission and overdue', () => {
  const now = Date.parse('2026-07-23T21:30:00');
  const items = collectFamilyAnomalies(
    [{ id: 'a', mustDo: true, forcedTriggerTime: '20:00', deadlineAt: null, status: 'pending' }] as any,
    {
      accessibilityEnabled: false,
      notificationGranted: true,
      notificationListenerEnabled: true,
      batteryOptimizationIgnored: true,
    },
    now,
  );
  expect(items.some((item) => item.type === 'permission_disabled')).toBe(true);
  expect(items.some((item) => item.type === 'task_overdue' && item.taskId === 'a')).toBe(true);
  expect(items.some((item) => item.type === 'forced_trigger_missed' && item.taskId === 'a')).toBe(true);
});

test('forcedTriggerAt parses local HH:mm', () => {
  const now = Date.parse('2026-07-23T12:00:00');
  const at = forcedTriggerAt('20:15', now)!;
  const date = new Date(at);
  expect(date.getHours()).toBe(20);
  expect(date.getMinutes()).toBe(15);
});

test('family anomaly type union stays explicit', () => {
  const types: FamilyAnomalyType[] = ['permission_disabled', 'reboot_detected', 'task_overdue', 'forced_trigger_missed'];
  expect(types).toHaveLength(4);
});
