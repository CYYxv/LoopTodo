import type { LockCapabilities } from '@/modules/lock-engine/lock-engine.types';
import type { Task } from '@/modules/tasks/task.types';

export type FamilyAnomalyType =
  | 'permission_disabled'
  | 'reboot_detected'
  | 'task_overdue'
  | 'forced_trigger_missed';

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

/** 今日必须：优先用强制触发时刻；无则用 deadline。已过点且未完成。 */
export function overdueMustDoTasks(tasks: Task[], nowMs: number): Task[] {
  return tasks.filter((task) => {
    if (!task.mustDo) return false;
    if (!(task.status === 'pending' || task.status === 'active' || task.status === 'failed')) return false;
    const triggerAt = forcedTriggerAt(task.forcedTriggerTime, nowMs);
    if (triggerAt != null) return triggerAt < nowMs;
    return task.deadlineAt != null && task.deadlineAt < nowMs;
  });
}

/** 强制触发已到点、任务仍 pending 视为错过强制（与逾期可重叠，服务端按日 dedupe）。 */
export function missedForcedTriggerTasks(tasks: Task[], nowMs: number): Task[] {
  return tasks.filter((task) => {
    if (!task.mustDo || task.status !== 'pending' || !task.forcedTriggerTime) return false;
    const triggerAt = forcedTriggerAt(task.forcedTriggerTime, nowMs);
    return triggerAt != null && triggerAt < nowMs;
  });
}

export function forcedTriggerAt(time: string | null | undefined, nowMs: number): number | null {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(nowMs);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export type FamilyAnomalyCandidate = { type: FamilyAnomalyType; taskId?: string };

/** 汇总本机可自动上报的异常（不含 reboot，由 hydrate 专用路径检测）。 */
export function collectFamilyAnomalies(
  tasks: Task[],
  capabilities: Parameters<typeof isPermissionAnomaly>[0] | null,
  nowMs: number,
): FamilyAnomalyCandidate[] {
  const out: FamilyAnomalyCandidate[] = [];
  if (capabilities && isPermissionAnomaly(capabilities)) {
    out.push({ type: 'permission_disabled' });
  }
  for (const task of overdueMustDoTasks(tasks, nowMs)) {
    out.push({ type: 'task_overdue', taskId: task.id });
  }
  for (const task of missedForcedTriggerTasks(tasks, nowMs)) {
    out.push({ type: 'forced_trigger_missed', taskId: task.id });
  }
  return out;
}
