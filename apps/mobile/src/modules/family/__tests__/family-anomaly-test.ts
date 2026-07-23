import { isPermissionAnomaly, overdueMustDoTasks, type FamilyAnomalyType } from '../family-anomaly';

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
    notificationListenerEnabled: true,
    batteryOptimizationIgnored: false,
  })).toBe(true);
});

test('lists overdue must-do tasks only', () => {
  const now = 1_000_000;
  const tasks = [
    { id: 'a', mustDo: true, deadlineAt: now - 1, status: 'pending' },
    { id: 'b', mustDo: true, deadlineAt: now + 1, status: 'pending' },
    { id: 'c', mustDo: false, deadlineAt: now - 1, status: 'pending' },
    { id: 'd', mustDo: true, deadlineAt: now - 5, status: 'completed' },
    { id: 'e', mustDo: true, deadlineAt: now - 5, status: 'failed' },
  ] as any;
  expect(overdueMustDoTasks(tasks, now).map((task) => task.id)).toEqual(['a', 'e']);
});

test('family anomaly type union stays explicit', () => {
  const types: FamilyAnomalyType[] = ['permission_disabled', 'reboot_detected', 'task_overdue'];
  expect(types).toHaveLength(3);
});
