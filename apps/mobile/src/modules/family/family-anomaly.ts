import type { LockCapabilities } from '@/modules/lock-engine/lock-engine.types';
import type { Task } from '@/modules/tasks/task.types';

export type FamilyAnomalyType = 'permission_disabled' | 'reboot_detected' | 'task_overdue';

export function isPermissionAnomaly(
  capabilities: Pick<
    LockCapabilities,
    'accessibilityEnabled' | 'notificationGranted' | 'notificationListenerEnabled' | 'batteryOptimizationIgnored'
  >,
): boolean {
  return (
    !capabilities.accessibilityEnabled ||
    !capabilities.notificationGranted ||
    !capabilities.notificationListenerEnabled ||
    !capabilities.batteryOptimizationIgnored
  );
}

/** 今日必须且已过截止时间、仍未完成的任务，视为逾期候选。 */
export function overdueMustDoTasks(tasks: Task[], nowMs: number): Task[] {
  return tasks.filter(
    (task) =>
      task.mustDo &&
      task.deadlineAt != null &&
      task.deadlineAt < nowMs &&
      (task.status === 'pending' || task.status === 'active' || task.status === 'failed'),
  );
}
