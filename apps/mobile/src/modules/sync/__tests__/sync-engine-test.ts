import { SyncApiError, type SyncApiClient } from '../sync-api.client';
import { SyncEngine } from '../sync.engine';
import type { SyncRepository } from '../sync.repository';
import type { OutboxItem, SyncConflict, SyncSnapshot } from '../sync.types';

function setup(items: OutboxItem[], execute: SyncApiClient['execute']) {
  const done: string[] = [];
  const retries: Array<{ id: string; attempts: number; at: number }> = [];
  const conflicts: SyncConflict[] = [];
  const maps = new Map<string, string>();
  let merged: SyncSnapshot | null = null;
  const repository: SyncRepository = {
    async listReady() { return items; },
    async markDone(id) { done.push(id); },
    async scheduleRetry(id, attempts, at) { retries.push({ id, attempts, at }); },
    async recordConflict(item, code) { conflicts.push({ id: item.id, entityType: 'task', entityId: item.entityId, code, localSnapshot: null, serverSnapshot: null, createdAt: 0 }); },
    async saveEntityMap(_type, localId, serverId) { maps.set(localId, serverId); },
    async getEntityMap(_type, localId) { return maps.get(localId) ?? null; },
    async getCursor() { return null; },
    async mergeSnapshot(snapshot) { merged = snapshot; },
    async summary() { return { pending: retries.length, conflicts, lastError: null }; },
    async resolveConflict() { return undefined; },
  };
  const snapshot: SyncSnapshot = { tasks: [], sessions: [], cursor: '2026-07-11T00:00:00.000Z' };
  const api: SyncApiClient = { execute, async pull() { return snapshot; } };
  return { engine: new SyncEngine(repository, api, () => 1000), done, retries, conflicts, maps, getMerged: () => merged };
}

describe('SyncEngine', () => {
  test('pushes start before finish and maps the server session', async () => {
    const calls: Array<{ type: string; mapped?: string }> = [];
    const items: OutboxItem[] = [
      { id: '1', operation: { type: 'session.start', taskId: 'task', localSessionId: 'local-session', mode: 'focus', startedAt: 0, plannedMinutes: 25 }, entityId: 'task', idempotencyKey: 'start-key', attempts: 0 },
      { id: '2', operation: { type: 'session.finish', taskId: 'task', localSessionId: 'local-session', outcome: 'completed', record: record() }, entityId: 'task', idempotencyKey: 'finish-key', attempts: 0 },
    ];
    const state = setup(items, async (operation, _key, mapped) => {
      calls.push({ type: operation.type, mapped });
      return operation.type === 'session.start' ? { serverSessionId: 'server-session' } : {};
    });

    await state.engine.run();

    expect(calls).toEqual([{ type: 'session.start', mapped: undefined }, { type: 'session.finish', mapped: 'server-session' }]);
    expect(state.done).toEqual(['1', '2']);
    expect(state.getMerged()?.cursor).toContain('2026');
  });

  test('uses exponential retry for network failure', async () => {
    const item: OutboxItem = { id: 'retry', operation: { type: 'task.goal-progress', taskId: 'task', version: 1, amount: 2 }, entityId: 'task', idempotencyKey: 'progress-key', attempts: 1 };
    const state = setup([item], async () => { throw new Error('offline'); });

    await state.engine.run();

    expect(state.retries).toEqual([{ id: 'retry', attempts: 2, at: 5000 }]);
  });

  test('records server conflicts without retrying', async () => {
    const item: OutboxItem = { id: 'conflict', operation: { type: 'task.goal-progress', taskId: 'task', version: 1, amount: 2 }, entityId: 'task', idempotencyKey: 'progress-key', attempts: 0 };
    const state = setup([item], async () => { throw new SyncApiError(409, 'VERSION_CONFLICT'); });

    await state.engine.run();

    expect(state.conflicts[0]?.code).toBe('VERSION_CONFLICT');
    expect(state.retries).toHaveLength(0);
  });
});

function record() {
  return { id: 'local-session', taskId: 'task', mode: 'focus' as const, timerMode: 'countdown' as const,
    phase: 'focus' as const, startedAt: 0, plannedEndAt: 60_000, restEndsAt: null, endedAt: 60_000,
    outcome: 'completed' as const, failureReason: null, durationSeconds: 60, completedAmount: null };
}
