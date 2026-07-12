import type { SyncOperation, SyncSnapshot } from './sync.types';

export class SyncApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly body?: unknown) { super(code); }
}

export interface SyncApiClient {
  execute(operation: SyncOperation, idempotencyKey: string, mappedSessionId?: string): Promise<{ serverSessionId?: string }>;
  pull(cursor: string | null): Promise<SyncSnapshot>;
}

export function createHttpSyncClient(baseUrl: string, accessToken: string): SyncApiClient {
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}`, ...init?.headers },
    });
    const body = await response.json();
    if (!response.ok) throw new SyncApiError(response.status, body.error?.code ?? 'SYNC_REQUEST_FAILED', body);
    return body.data;
  };
  return {
    async execute(operation, key, mappedSessionId) {
      const headers = { 'idempotency-key': key };
      if (operation.type === 'task.create') {
        const task = operation.task;
        await request('/tasks', { method: 'POST', body: JSON.stringify({ id: task.id, title: task.title,
          taskType: task.kind, timerMode: task.timerMode, estimatedMinutes: task.estimateMinutes,
          restMinutes: task.restMinutes, deadlineAt: task.deadlineAt ? new Date(task.deadlineAt).toISOString() : undefined,
          targetAmount: task.targetAmount ?? undefined, targetUnit: task.targetUnit ?? undefined,
          isTodayRequired: task.mustDo }) });
        return {};
      }
      if (operation.type === 'session.start') {
        const session = await request(`/tasks/${operation.taskId}/start-${operation.mode}`, { method: 'POST', headers,
          body: JSON.stringify({ sessionId: operation.localSessionId, startedAt: new Date(operation.startedAt).toISOString(),
            plannedMinutes: operation.plannedMinutes }) });
        return { serverSessionId: session.id };
      }
      if (operation.type === 'session.finish') {
        if (!mappedSessionId) throw new Error('SESSION_MAPPING_PENDING');
        await request(`/focus-sessions/${mappedSessionId}/finish`, { method: 'POST', headers,
          body: JSON.stringify({ outcome: serverOutcome(operation.outcome, operation.record.mode),
            endedAt: new Date(operation.record.endedAt).toISOString(),
            actualMinutes: Math.ceil(operation.record.durationSeconds / 60),
            failureReasonText: operation.record.failureReason }) });
        return {};
      }
      await request(`/tasks/${operation.taskId}/progress`, { method: 'POST', headers,
        body: JSON.stringify({ version: operation.version, amount: operation.amount }) });
      return {};
    },
    pull(cursor) {
      return request(`/sync/task-focus${cursor ? `?since=${encodeURIComponent(cursor)}` : ''}`);
    },
  };
}

export function serverOutcome(outcome: 'completed' | 'exited', mode: 'focus' | 'lock') {
  if (outcome === 'completed') return 'completed';
  return mode === 'lock' ? 'emergency_exit' : 'cancelled';
}
