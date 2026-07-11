import type { OutboxItem, SyncConflict, SyncOperation, SyncSnapshot } from './sync.types';

export interface SyncRepository {
  listReady(now: number): Promise<OutboxItem[]>;
  markDone(id: string): Promise<void>;
  scheduleRetry(id: string, attempts: number, nextAttemptAt: number, error: string): Promise<void>;
  recordConflict(item: OutboxItem, code: string, serverSnapshot?: unknown): Promise<void>;
  saveEntityMap(type: 'session', localId: string, serverId: string): Promise<void>;
  getEntityMap(type: 'session', localId: string): Promise<string | null>;
  getCursor(): Promise<string | null>;
  mergeSnapshot(snapshot: SyncSnapshot): Promise<void>;
  summary(): Promise<{ pending: number; conflicts: SyncConflict[]; lastError: string | null }>;
  resolveConflict(id: string, strategy: 'cloud' | 'local'): Promise<void>;
}

export type EnqueueOperation = (operation: SyncOperation, entityId: string, key: string) => Promise<void>;
