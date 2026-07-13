import type { ActiveSession } from '@/modules/focus-session/focus-session.types';

import type { Task } from './task.types';

export type TaskExecutionState =
  | 'available'
  | 'local_active'
  | 'remote_active'
  | 'sync_conflict'
  | 'stale_active'
  | 'completed';

export function getTaskExecutionState(task: Task, activeSession: ActiveSession | null): TaskExecutionState {
  if (task.status === 'completed' || task.status === 'archived') return 'completed';
  if (task.syncStatus === 'conflict') return 'sync_conflict';
  if (activeSession?.taskId === task.id) return 'local_active';
  if (task.remoteActive) return 'remote_active';
  if (task.status === 'active') return 'stale_active';
  return 'available';
}

export function taskExecutionReason(state: TaskExecutionState) {
  return {
    available: null,
    local_active: '本机正在执行，点击继续',
    remote_active: '正在其他设备执行',
    sync_conflict: '任务存在同步冲突，请先处理',
    stale_active: '任务状态尚未恢复，请刷新同步状态',
    completed: '任务已完成',
  }[state];
}
