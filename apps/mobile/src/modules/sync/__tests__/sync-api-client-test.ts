import { createHttpSyncClient, SyncApiError } from '../sync-api.client';
import type { RemoteWhitelistList } from '../sync.types';

afterEach(() => {
  jest.restoreAllMocks();
});

test('sends task edits through the task update endpoint', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(apiResponse(200, {}));
  const client = createHttpSyncClient('https://example.com', 'token');

  await client.execute({
    type: 'task.update', taskId: 'task-1', version: 3,
    patch: { title: '修改后的任务', timerMode: 'countdown', estimateMinutes: 40, restMinutes: 5,
      deadlineAt: null, targetAmount: null, targetUnit: null, mustDo: true, forcedTriggerTime: '20:00', status: 'pending' },
  }, 'task-update-task-1-3');

  expect(fetchMock).toHaveBeenCalledWith('https://example.com/tasks/task-1', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ version: 3, title: '修改后的任务', timerMode: 'countdown', estimatedMinutes: 40,
      restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null, isTodayRequired: true,
      forcedTriggerTime: '20:00', status: 'pending' }),
  }));
});

test('sends whitelist CRUD with each operation idempotency key', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(apiResponse(200, {}));
  const client = createHttpSyncClient('https://example.com', 'token');
  const list = { id: 'list-1', name: '学习', packages: ['com.reader'], isDefault: false, version: 1, syncStatus: 'pending' as const };

  await client.execute({ type: 'whitelist.create', list }, 'create-list-1');
  await client.execute({ type: 'whitelist.update', listId: 'list-1', version: 1, name: '深度学习', packages: ['com.reader'] }, 'update-list-1');
  await client.execute({ type: 'whitelist.set-default', listId: 'list-1', version: 2 }, 'default-list-1');
  await client.execute({ type: 'whitelist.delete', listId: 'list-1', version: 3, replacementId: 'list-2' }, 'delete-list-1');

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'https://example.com/whitelist-lists',
    'https://example.com/whitelist-lists/list-1',
    'https://example.com/whitelist-lists/list-1/default',
    'https://example.com/whitelist-lists/list-1?version=3&replacementId=list-2',
  ]);
  expect(fetchMock.mock.calls.map(([, init]) => (init?.headers as Record<string, string>)['idempotency-key']))
    .toEqual(['create-list-1', 'update-list-1', 'default-list-1', 'delete-list-1']);
});

test('omits fields rejected by the finish session DTO', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(apiResponse(200, {}));
  const client = createHttpSyncClient('https://example.com', 'token');

  await client.execute({
    type: 'session.finish', taskId: 'task-1', localSessionId: 'local-session', outcome: 'completed',
    record: {
      id: 'local-session', taskId: 'task-1', mode: 'focus', timerMode: 'countdown', phase: 'focus',
      startedAt: 0, plannedEndAt: 60_000, restEndsAt: null, endedAt: 60_000, outcome: 'completed',
      failureReason: null, durationSeconds: 60, completedAmount: null, restrictionMode: 'whitelist',
      whitelistSource: 'list:list-1', whitelistPackageCount: 2, restrictionEffective: true, effectiveMinutes: 1,
    },
  }, 'finish-session-1', 'server-session');

  const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
  expect(payload).toEqual(expect.objectContaining({
    whitelistPackageCount: 2,
    restrictionEffective: true,
    effectiveMinutes: 1,
  }));
  expect(payload).not.toHaveProperty('restrictionMode');
  expect(payload).not.toHaveProperty('whitelistSource');
});

test('uploads the resolved allowed package snapshot when a session starts', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(apiResponse(200, { id: 'server-session' }));
  const client = createHttpSyncClient('https://example.com', 'token');

  await client.execute({
    type: 'session.start', taskId: 'task-1', localSessionId: 'local-session', mode: 'focus',
    startedAt: 1_000, plannedMinutes: 25, restrictionMode: 'whitelist', whitelistSource: 'custom',
    restrictionEffective: true, allowedPackagesSnapshot: ['com.reader', 'com.notes'],
  } as never, 'start-session-1');

  const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
  expect(payload.allowedPackagesSnapshot).toEqual(['com.reader', 'com.notes']);
});

test('fetches the complete remote whitelist after a 409 response', async () => {
  const remote = remoteWhitelist();
  const fetchMock = jest.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(apiErrorResponse(409, 'VERSION_CONFLICT'))
    .mockResolvedValueOnce(apiResponse(200, remote));
  const client = createHttpSyncClient('https://example.com', 'token');

  await expect(client.execute({
    type: 'whitelist.update', listId: 'list-1', version: 2, name: '本地名单', packages: ['com.local'],
  }, 'update-list-1')).rejects.toMatchObject({
    status: 409,
    code: 'VERSION_CONFLICT',
    body: remote,
  } satisfies Partial<SyncApiError>);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'https://example.com/whitelist-lists/list-1',
    'https://example.com/whitelist-lists/list-1',
  ]);
});

test('finds the existing remote whitelist by name after a create name conflict', async () => {
  const remote = remoteWhitelist({ id: 'remote-list', name: '学习名单', isDefault: false });
  jest.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(apiErrorResponse(409, 'WHITELIST_LIST_EXISTS'))
    .mockResolvedValueOnce(apiErrorResponse(404, 'WHITELIST_LIST_NOT_FOUND'))
    .mockResolvedValueOnce(apiResponse(200, {
      whitelistLists: [remote], tasks: [], sessions: [], cursor: '2026-07-27T01:00:00.000Z',
    }));
  const client = createHttpSyncClient('https://example.com', 'token');

  await expect(client.execute({ type: 'whitelist.create', list: {
    id: 'local-list', name: '学习名单', packages: ['com.local'], isDefault: false, version: 1, syncStatus: 'pending',
  } }, 'create-local-list')).rejects.toMatchObject({
    status: 409,
    code: 'WHITELIST_LIST_EXISTS',
    body: remote,
  } satisfies Partial<SyncApiError>);
});

test('attaches the sync tombstone when an update targets a remotely deleted whitelist', async () => {
  const tombstone = remoteWhitelist({ isDefault: false, version: 4, archivedAt: '2026-07-27T01:00:00.000Z' });
  const fetchMock = jest.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(apiErrorResponse(404, 'WHITELIST_LIST_NOT_FOUND'))
    .mockResolvedValueOnce(apiErrorResponse(404, 'WHITELIST_LIST_NOT_FOUND'))
    .mockResolvedValueOnce(apiResponse(200, {
      whitelistLists: [tombstone], tasks: [], sessions: [], cursor: '2026-07-27T01:00:00.000Z',
    }));
  const client = createHttpSyncClient('https://example.com', 'token');

  await expect(client.execute({
    type: 'whitelist.update', listId: 'list-1', version: 2, name: '本地名单', packages: ['com.local'],
  }, 'update-list-1')).rejects.toMatchObject({
    status: 404,
    code: 'WHITELIST_LIST_NOT_FOUND',
    body: tombstone,
  } satisfies Partial<SyncApiError>);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'https://example.com/whitelist-lists/list-1',
    'https://example.com/whitelist-lists/list-1',
    'https://example.com/sync/task-focus',
  ]);
});

function apiResponse(status: number, data: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({ data, error: null }) } as Response;
}

function apiErrorResponse(status: number, code: string) {
  return { ok: false, status, json: async () => ({ data: null, error: { code, message: code } }) } as Response;
}

function remoteWhitelist(overrides: Partial<RemoteWhitelistList> = {}): RemoteWhitelistList {
  return {
    id: 'list-1', name: '云端名单', packages: ['com.cloud'], isDefault: true, version: 3,
    archivedAt: null, updatedAt: '2026-07-27T00:00:00.000Z', ...overrides,
  };
}
