import { SyncApiError, type SyncApiClient } from './sync-api.client';
import type { SyncRepository } from './sync.repository';
import type { RemoteWhitelistList } from './sync.types';

export class SyncEngine {
  constructor(
    private readonly repository: SyncRepository,
    private readonly api: SyncApiClient,
    private readonly now: () => number = Date.now
  ) {}

  async run() {
    const items = await this.repository.listReady(this.now());
    const blockedEntities = new Set<string>();
    for (const item of items) {
      if (blockedEntities.has(item.entityId)) {
        await this.repository.scheduleRetry(item.id, item.attempts, this.now() + 2_000, 'DEPENDENCY_CONFLICT');
        continue;
      }
      try {
        const mappedSessionId = item.operation.type === 'session.finish'
          ? await this.repository.getEntityMap('session', item.operation.localSessionId)
          : undefined;
        if (item.operation.type === 'session.finish' && !mappedSessionId) {
          await this.repository.scheduleRetry(item.id, item.attempts, this.now() + 2_000, 'SESSION_MAPPING_PENDING');
          continue;
        }
        const result = await this.api.execute(item.operation, item.idempotencyKey, mappedSessionId ?? undefined);
        if (item.operation.type === 'session.start' && result.serverSessionId) {
          await this.repository.saveEntityMap('session', item.operation.localSessionId, result.serverSessionId);
        }
        await this.repository.markDone(item.id);
      } catch (error) {
        const whitelistTombstone = error instanceof SyncApiError && error.status === 404 &&
          item.operation.type.startsWith('whitelist.') && isRemoteWhitelistList(error.body) && Boolean(error.body.archivedAt);
        if (error instanceof SyncApiError && (error.status === 409 || whitelistTombstone)) {
          await this.repository.recordConflict(item, error.code, error.body);
          blockedEntities.add(item.entityId);
          continue;
        }
        const attempts = item.attempts + 1;
        await this.repository.scheduleRetry(item.id, attempts, this.now() + backoff(attempts), message(error));
        break;
      }
    }
    const snapshot = await this.api.pull(await this.repository.getCursor());
    await this.repository.mergeSnapshot(snapshot);
    return this.repository.summary();
  }
}

function backoff(attempts: number) { return Math.min(300_000, 2_000 * 2 ** Math.min(attempts - 1, 8)); }
function message(error: unknown) { return error instanceof Error ? error.message : 'SYNC_FAILED'; }
function isRemoteWhitelistList(value: unknown): value is RemoteWhitelistList {
  if (!value || typeof value !== 'object') return false;
  const list = value as Partial<RemoteWhitelistList>;
  return typeof list.id === 'string' && typeof list.name === 'string' && Array.isArray(list.packages) &&
    typeof list.isDefault === 'boolean' && typeof list.version === 'number' &&
    (list.archivedAt === null || typeof list.archivedAt === 'string') && typeof list.updatedAt === 'string';
}
