import type { RemoteWhitelistList, SyncOperation, SyncSnapshot } from './sync.types';

export class SyncApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly body?: unknown) { super(code); }
}

export interface SyncApiClient {
  execute(operation: SyncOperation, idempotencyKey: string, mappedSessionId?: string): Promise<{ serverSessionId?: string }>;
  pull(cursor: string | null): Promise<SyncSnapshot>;
}

export function createHttpSyncClient(baseUrl: string, accessToken: string): SyncApiClient {
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}`, ...init?.headers },
    });
    const body = await response.json() as { data: T | null; error: { code?: string } | null };
    if (!response.ok) throw new SyncApiError(response.status, body.error?.code ?? 'SYNC_REQUEST_FAILED', body);
    return body.data as T;
  };
  const remoteWhitelist = async (id: string, fallbackName?: string) => {
    try {
      return await request<RemoteWhitelistList>(`/whitelist-lists/${id}`);
    } catch (error) {
      if (!(error instanceof SyncApiError) || error.status !== 404) throw error;
    }
    const snapshot = await request<SyncSnapshot>('/sync/task-focus');
    return snapshot.whitelistLists?.find((list) => list.id === id) ??
      (fallbackName ? snapshot.whitelistLists?.find((list) => !list.archivedAt && list.name === fallbackName) : undefined);
  };
  const mutateWhitelist = async (id: string, key: string, path: string, init: RequestInit, fallbackName?: string) => {
    try {
      await request(path, { ...init, headers: { ...init.headers, 'idempotency-key': key } });
    } catch (error) {
      if (!(error instanceof SyncApiError) || (error.status !== 409 && error.status !== 404)) throw error;
      const latest = await remoteWhitelist(id, fallbackName);
      if (!latest) throw error;
      throw new SyncApiError(error.status, error.code, latest);
    }
  };
  return {
    async execute(operation, key, mappedSessionId) {
      const headers = { 'idempotency-key': key };
      if (operation.type === 'whitelist.create') {
        await mutateWhitelist(operation.list.id, key, '/whitelist-lists', { method: 'POST', body: JSON.stringify({ id: operation.list.id, name: operation.list.name, packages: operation.list.packages }) }, operation.list.name);
        return {};
      }
      if (operation.type === 'whitelist.update') {
        await mutateWhitelist(operation.listId, key, `/whitelist-lists/${operation.listId}`, { method: 'PATCH', body: JSON.stringify({ version: operation.version, name: operation.name, packages: operation.packages }) });
        return {};
      }
      if (operation.type === 'whitelist.set-default') {
        await mutateWhitelist(operation.listId, key, `/whitelist-lists/${operation.listId}/default`, { method: 'POST', body: JSON.stringify({ version: operation.version }) });
        return {};
      }
      if (operation.type === 'whitelist.delete') {
        const replacement = operation.replacementId ? `&replacementId=${encodeURIComponent(operation.replacementId)}` : '';
        await mutateWhitelist(operation.listId, key, `/whitelist-lists/${operation.listId}?version=${operation.version}${replacement}`, { method: 'DELETE' });
        return {};
      }
      if (operation.type === 'category.create') {
        await request('/task-categories', { method: 'POST', body: JSON.stringify({ id: operation.category.id, name: operation.category.name, color: operation.category.color }) });
        return {};
      }
      if (operation.type === 'category.update') {
        await request(`/task-categories/${operation.categoryId}`, { method: 'PATCH', body: JSON.stringify({ version: operation.version, name: operation.name, color: operation.color }) });
        return {};
      }
      if (operation.type === 'category.delete') {
        await request(`/task-categories/${operation.categoryId}?version=${operation.version}`, { method: 'DELETE' });
        return {};
      }
      if (operation.type === 'task.create') {
        const task = operation.task;
        await request('/tasks', { method: 'POST', body: JSON.stringify({ id: task.id, categoryId: task.categoryId ?? undefined, title: task.title,
          taskType: task.kind, timerMode: task.timerMode, estimatedMinutes: task.estimateMinutes,
          restMinutes: task.restMinutes, deadlineAt: task.deadlineAt ? new Date(task.deadlineAt).toISOString() : undefined,
          targetAmount: task.targetAmount ?? undefined, targetUnit: task.targetUnit ?? undefined,
          isTodayRequired: task.mustDo, forcedTriggerTime: task.forcedTriggerTime, restrictionMode: task.restrictionMode,
          whitelistMode: task.whitelistMode === 'inherit' ? 'list' : task.whitelistMode, whitelistListId: task.whitelistListId ?? undefined,
          whitelistPackages: task.whitelistPackages ?? [] }) });
        return {};
      }
      if (operation.type === 'task.update') {
        const patch = operation.patch;
        await request(`/tasks/${operation.taskId}`, { method: 'PATCH', body: JSON.stringify({ version: operation.version,
          categoryId: patch.categoryId, title: patch.title, timerMode: patch.timerMode, estimatedMinutes: patch.estimateMinutes,
          restMinutes: patch.restMinutes, deadlineAt: patch.deadlineAt ? new Date(patch.deadlineAt).toISOString() : null,
          targetAmount: patch.targetAmount, targetUnit: patch.targetUnit, isTodayRequired: patch.mustDo,
          forcedTriggerTime: patch.forcedTriggerTime, status: patch.status, restrictionMode: patch.restrictionMode,
          whitelistMode: patch.whitelistMode === 'inherit' ? 'list' : patch.whitelistMode,
          whitelistListId: patch.whitelistListId, whitelistPackages: patch.whitelistPackages }) });
        return {};
      }
      if (operation.type === 'task.delete') {
        await request(`/tasks/${operation.taskId}?version=${operation.version}`, { method: 'DELETE' });
        return {};
      }
      if (operation.type === 'session.start') {
        const session = await request<{ id: string }>(`/tasks/${operation.taskId}/start-${operation.mode}`, { method: 'POST', headers,
          body: JSON.stringify({ sessionId: operation.localSessionId, startedAt: new Date(operation.startedAt).toISOString(),
            plannedMinutes: operation.plannedMinutes, restrictionMode: operation.restrictionMode,
            whitelistSource: operation.whitelistSource, restrictionEffective: operation.restrictionEffective,
            allowedPackagesSnapshot: operation.allowedPackagesSnapshot }) });
        return { serverSessionId: session.id };
      }
      if (operation.type === 'session.finish') {
        if (!mappedSessionId) throw new Error('SESSION_MAPPING_PENDING');
        await request(`/focus-sessions/${mappedSessionId}/finish`, { method: 'POST', headers,
          body: JSON.stringify({ outcome: serverOutcome(operation.outcome, operation.record.mode),
            endedAt: new Date(operation.record.endedAt).toISOString(),
            actualMinutes: Math.ceil(operation.record.durationSeconds / 60),
            completionNote: operation.record.completionNote,
            failureReasonText: operation.record.failureReason,
            whitelistPackageCount: operation.record.whitelistPackageCount,
            restrictionEffective: operation.record.restrictionEffective,
            effectiveMinutes: operation.record.effectiveMinutes }) });
        return {};
      }
      await request(`/tasks/${operation.taskId}/progress`, { method: 'POST', headers,
        body: JSON.stringify({ version: operation.version, amount: operation.amount }) });
      return {};
    },
    pull(cursor) {
      return request<SyncSnapshot>(`/sync/task-focus${cursor ? `?since=${encodeURIComponent(cursor)}` : ''}`);
    },
  };
}

export function serverOutcome(outcome: 'completed' | 'exited', mode: 'focus' | 'lock') {
  if (outcome === 'completed') return 'completed';
  return mode === 'lock' ? 'emergency_exit' : 'cancelled';
}
