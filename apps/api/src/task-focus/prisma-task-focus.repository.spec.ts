import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { PrismaTaskFocusRepository } from './prisma-task-focus.repository';

test('persists and maps the restriction snapshot when starting a session', async () => {
  const startedAt = new Date('2026-07-27T01:00:00.000Z');
  const updatedAt = new Date('2026-07-27T01:00:01.000Z');
  const task = {
    id: 'task-1', userId: 'user-1', status: 'pending', activeSessionId: null, version: 1,
    timerMode: 'countdown', estimatedMinutes: 25, whitelistMode: 'list', whitelistListId: 'study', whitelistPackages: [],
  };
  const transaction = {
    task: {
      findFirst: jest.fn(async () => task),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    focusSession: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        endedAt: null,
        actualMinutes: null,
        outcome: null,
        completionNote: null,
        failureReasonType: null,
        failureReasonText: null,
        finishIdempotencyKey: null,
        syncedAt: null,
        createdAt: startedAt,
        updatedAt,
        effectiveMinutes: 0,
      })),
    },
    whitelistList: { findFirst: jest.fn(async () => ({ id: 'study', userId: 'user-1', archivedAt: null, packages: ['com.reader'] })) },
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  const result = await repository.startSession({
    userId: 'user-1',
    taskId: task.id,
    mode: 'focus',
    idempotencyKey: 'start-key',
    trustLevel: 'open',
    sessionId: 'session-1',
    startedAt,
    restrictionMode: 'whitelist',
    whitelistSource: 'list:study',
    restrictionEffective: true,
    allowedPackagesSnapshot: ['com.reader'],
  } as never);

  expect(transaction.focusSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    restrictionMode: 'whitelist',
    whitelistSource: 'list:study',
    whitelistPackageCount: 1,
    allowedPackagesSnapshot: ['com.reader'],
    restrictionEffective: true,
  }) });
  expect(result).toMatchObject({ status: 'ok', value: {
    restrictionMode: 'whitelist',
    whitelistSource: 'list:study',
    whitelistPackageCount: 1,
    allowedPackagesSnapshot: ['com.reader'],
    restrictionEffective: true,
    effectiveMinutes: 0,
  } });
});

test('persists and maps final restriction measurements when finishing a session', async () => {
  const startedAt = new Date('2026-07-27T01:00:00.000Z');
  const endedAt = new Date('2026-07-27T01:25:00.000Z');
  const updatedAt = new Date('2026-07-27T01:25:01.000Z');
  const session = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown',
    trustLevel: 'open', startedAt, endedAt: null, plannedMinutes: 25, actualMinutes: null,
    outcome: null, completionNote: null, failureReasonType: null, failureReasonText: null,
    startIdempotencyKey: 'start-key', finishIdempotencyKey: null, syncedAt: null,
    createdAt: startedAt, updatedAt: startedAt, restrictionMode: 'whitelist',
    whitelistSource: 'custom', whitelistPackageCount: 0, restrictionEffective: true, effectiveMinutes: 0,
  };
  const finished = {
    ...session,
    endedAt,
    actualMinutes: 25,
    outcome: 'completed',
    whitelistPackageCount: 3,
    restrictionEffective: false,
    effectiveMinutes: 22,
    updatedAt,
  };
  const transaction = {
    focusSession: {
      findFirst: jest.fn(async () => session),
      count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => finished),
    },
    task: {
      findFirst: jest.fn(async () => ({ id: 'task-1', activeSessionId: 'session-1' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  const result = await repository.finishSession({
    userId: 'user-1', sessionId: session.id, idempotencyKey: 'finish-key', outcome: 'completed',
    completionNote: null, failureReasonType: null, failureReasonText: null, endedAt, actualMinutes: 25,
    whitelistPackageCount: 3, restrictionEffective: false, effectiveMinutes: 22,
  } as never);

  expect(transaction.focusSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      whitelistPackageCount: 3,
      restrictionEffective: false,
      effectiveMinutes: 22,
    }),
  }));
  expect(result).toMatchObject({ status: 'ok', value: {
    whitelistPackageCount: 3,
    restrictionEffective: false,
    effectiveMinutes: 22,
  } });
});

test('bounds final measurements by elapsed time and countdown plan', async () => {
  const startedAt = new Date('2026-07-27T01:00:00.000Z');
  const endedAt = new Date('2026-07-27T01:40:00.000Z');
  jest.useFakeTimers().setSystemTime(endedAt);
  const session = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown',
    trustLevel: 'open', startedAt, endedAt: null, plannedMinutes: 25, actualMinutes: null,
    outcome: null, completionNote: null, failureReasonType: null, failureReasonText: null,
    startIdempotencyKey: 'start-key', finishIdempotencyKey: null, syncedAt: null,
    createdAt: startedAt, updatedAt: startedAt, restrictionMode: 'whitelist',
    whitelistSource: 'custom', whitelistPackageCount: 0, restrictionEffective: true, effectiveMinutes: 0,
  };
  const transaction = {
    focusSession: {
      findFirst: jest.fn(async () => session),
      count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => ({ ...session, endedAt, actualMinutes: 25, effectiveMinutes: 25, outcome: 'completed' })),
    },
    task: {
      findFirst: jest.fn(async () => ({ id: 'task-1', activeSessionId: 'session-1' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await repository.finishSession({
    userId: 'user-1', sessionId: session.id, idempotencyKey: 'finish-key', outcome: 'completed',
    completionNote: null, failureReasonType: null, failureReasonText: null, endedAt,
    actualMinutes: 1_440, restrictionEffective: true, effectiveMinutes: 1_440,
  });

  expect(transaction.focusSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ endedAt, actualMinutes: 25, effectiveMinutes: 25 }),
  }));
  jest.useRealTimers();
});

test('rejects an end time before the session start or obviously in the future', async () => {
  const now = new Date('2026-07-27T01:30:00.000Z');
  jest.useFakeTimers().setSystemTime(now);
  const session = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', startedAt: new Date('2026-07-27T01:00:00.000Z'),
    endedAt: null, timerMode: 'countup', plannedMinutes: 25, restrictionEffective: true,
  };
  const transaction = {
    focusSession: {
      findFirst: jest.fn(async () => session),
      count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    task: {
      findFirst: jest.fn(async () => ({ id: 'task-1', activeSessionId: 'session-1' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);
  const base = {
    userId: 'user-1', sessionId: session.id, outcome: 'completed' as const,
    completionNote: null, failureReasonType: null, failureReasonText: null,
  };

  await expect(repository.finishSession({ ...base, idempotencyKey: 'finish-early', endedAt: new Date('2026-07-27T00:59:59.000Z') }))
    .resolves.toEqual({ status: 'invalid-session-time' });
  await expect(repository.finishSession({ ...base, idempotencyKey: 'finish-future', endedAt: new Date('2026-07-27T01:35:01.000Z') }))
    .resolves.toEqual({ status: 'invalid-session-time' });
  expect(transaction.focusSession.updateMany).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test('never upgrades restriction effectiveness and replays the stored settlement', async () => {
  const startedAt = new Date('2026-07-27T01:00:00.000Z');
  const endedAt = new Date('2026-07-27T01:10:00.000Z');
  jest.useFakeTimers().setSystemTime(endedAt);
  const session = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', mode: 'focus', timerMode: 'countup',
    trustLevel: 'open', startedAt, endedAt: null, plannedMinutes: 25, actualMinutes: null,
    outcome: null, completionNote: null, failureReasonType: null, failureReasonText: null,
    startIdempotencyKey: 'start-key', finishIdempotencyKey: null, syncedAt: null,
    createdAt: startedAt, updatedAt: startedAt, restrictionMode: 'whitelist',
    whitelistSource: 'custom', whitelistPackageCount: 0, restrictionEffective: false, effectiveMinutes: 0,
  };
  const stored = { ...session, endedAt, actualMinutes: 10, effectiveMinutes: 10, outcome: 'completed', finishIdempotencyKey: 'finish-key' };
  const replayLookup = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
  const transaction = {
    focusSession: {
      findFirst: jest.fn(async () => session),
      count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => stored),
    },
    task: {
      findFirst: jest.fn(async () => ({ id: 'task-1', activeSessionId: 'session-1' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    focusSession: { findFirst: replayLookup },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);
  const base = {
    userId: 'user-1', sessionId: session.id, idempotencyKey: 'finish-key', outcome: 'completed' as const,
    completionNote: null, failureReasonType: null, failureReasonText: null,
  };

  const first = await repository.finishSession({ ...base, actualMinutes: 10, restrictionEffective: true, effectiveMinutes: 10 });
  const replay = await repository.finishSession({ ...base, endedAt: new Date('2099-01-01'), actualMinutes: 1_440, restrictionEffective: true, effectiveMinutes: 1_440 });

  expect(transaction.focusSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ restrictionEffective: false }),
  }));
  expect(first).toMatchObject({ status: 'ok', value: { restrictionEffective: false } });
  expect(replay).toMatchObject({ status: 'ok', replayed: true, value: { actualMinutes: 10, restrictionEffective: false, effectiveMinutes: 10 } });
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('clamps finish minutes to elapsed time and the countdown plan', async () => {
  const startedAt = new Date('2026-07-27T01:00:00.000Z');
  const endedAt = new Date('2026-07-27T01:40:00.000Z');
  jest.useFakeTimers().setSystemTime(endedAt);
  const session = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown',
    trustLevel: 'open', startedAt, endedAt: null, plannedMinutes: 25, actualMinutes: null,
    outcome: null, completionNote: null, failureReasonType: null, failureReasonText: null,
    startIdempotencyKey: 'start-key', finishIdempotencyKey: null, syncedAt: null,
    createdAt: startedAt, updatedAt: startedAt, restrictionMode: 'whitelist',
    whitelistSource: 'custom', whitelistPackageCount: 0, restrictionEffective: true, effectiveMinutes: 0,
  };
  const transaction = {
    focusSession: {
      findFirst: jest.fn(async () => session),
      count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => ({ ...session, endedAt, actualMinutes: 25, effectiveMinutes: 25 })),
    },
    task: {
      findFirst: jest.fn(async () => ({ id: 'task-1', activeSessionId: 'session-1' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await repository.finishSession({
    userId: 'user-1', sessionId: session.id, idempotencyKey: 'finish-key', outcome: 'completed',
    completionNote: null, failureReasonType: null, failureReasonText: null, endedAt,
    actualMinutes: 1_440, restrictionEffective: true, effectiveMinutes: 1_440,
  });

  expect(transaction.focusSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ actualMinutes: 25, effectiveMinutes: 25 }),
  }));
  jest.useRealTimers();
});

test('does not upgrade an ineffective restriction during finish', async () => {
  const startedAt = new Date('2026-07-27T01:00:00.000Z');
  const endedAt = new Date('2026-07-27T01:10:00.000Z');
  jest.useFakeTimers().setSystemTime(endedAt);
  const session = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', mode: 'focus', timerMode: 'countup',
    trustLevel: 'open', startedAt, endedAt: null, plannedMinutes: 25, actualMinutes: null,
    outcome: null, completionNote: null, failureReasonType: null, failureReasonText: null,
    startIdempotencyKey: 'start-key', finishIdempotencyKey: null, syncedAt: null,
    createdAt: startedAt, updatedAt: startedAt, restrictionMode: 'whitelist',
    whitelistSource: 'custom', whitelistPackageCount: 0, restrictionEffective: false, effectiveMinutes: 0,
  };
  const transaction = {
    focusSession: {
      findFirst: jest.fn(async () => session), count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => ({ ...session, endedAt, actualMinutes: 10, restrictionEffective: false, effectiveMinutes: 10 })),
    },
    task: {
      findFirst: jest.fn(async () => ({ id: 'task-1', activeSessionId: 'session-1' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await repository.finishSession({
    userId: 'user-1', sessionId: session.id, idempotencyKey: 'finish-key', outcome: 'completed',
    completionNote: null, failureReasonType: null, failureReasonText: null, endedAt,
    actualMinutes: 10, restrictionEffective: true, effectiveMinutes: 10,
  });

  expect(transaction.focusSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ restrictionEffective: false }),
  }));
  jest.useRealTimers();
});

test.each([
  ['before session start', new Date('2026-07-27T00:59:59.000Z')],
  ['clearly in the future', new Date('2026-07-27T01:16:00.000Z')],
])('rejects an end time %s', async (_label, endedAt) => {
  const now = new Date('2026-07-27T01:10:00.000Z');
  jest.useFakeTimers().setSystemTime(now);
  const session = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', mode: 'focus', timerMode: 'countup',
    trustLevel: 'open', startedAt: new Date('2026-07-27T01:00:00.000Z'), endedAt: null,
    plannedMinutes: 25, actualMinutes: null, outcome: null, completionNote: null,
    failureReasonType: null, failureReasonText: null, startIdempotencyKey: 'start-key',
    finishIdempotencyKey: null, syncedAt: null, createdAt: now, updatedAt: now,
    restrictionMode: 'none', whitelistSource: 'none', whitelistPackageCount: 0,
    restrictionEffective: true, effectiveMinutes: 0,
  };
  const transaction = {
    focusSession: {
      findFirst: jest.fn(async () => session), count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => ({ ...session, endedAt, outcome: 'completed' })),
    },
    task: {
      findFirst: jest.fn(async () => ({ id: 'task-1', activeSessionId: 'session-1' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await expect(repository.finishSession({
    userId: 'user-1', sessionId: session.id, idempotencyKey: 'finish-key', outcome: 'completed',
    completionNote: null, failureReasonType: null, failureReasonText: null, endedAt,
  })).resolves.toEqual({ status: 'invalid-session-time' });
  expect(transaction.focusSession.updateMany).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test('returns the original settlement for an idempotent finish replay', async () => {
  const settled = {
    id: 'session-1', userId: 'user-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown',
    trustLevel: 'open', startedAt: new Date('2026-07-27T01:00:00.000Z'),
    endedAt: new Date('2026-07-27T01:25:00.000Z'), plannedMinutes: 25, actualMinutes: 25,
    outcome: 'completed', completionNote: null, failureReasonType: null, failureReasonText: null,
    startIdempotencyKey: 'start-key', finishIdempotencyKey: 'finish-key', syncedAt: null,
    createdAt: new Date('2026-07-27T01:00:00.000Z'), updatedAt: new Date('2026-07-27T01:25:00.000Z'),
    restrictionMode: 'whitelist', whitelistSource: 'custom', whitelistPackageCount: 3,
    restrictionEffective: false, effectiveMinutes: 22,
  };
  const prisma = {
    focusSession: { findFirst: jest.fn(async () => settled) },
    $transaction: jest.fn(),
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await expect(repository.finishSession({
    userId: 'user-1', sessionId: settled.id, idempotencyKey: 'finish-key', outcome: 'completed',
    completionNote: null, failureReasonType: null, failureReasonText: null,
    endedAt: new Date('2099-01-01T00:00:00.000Z'), actualMinutes: 1_440,
    restrictionEffective: true, effectiveMinutes: 1_440,
  })).resolves.toMatchObject({ status: 'ok', value: {
    actualMinutes: 25, restrictionEffective: false, effectiveMinutes: 22,
  }, replayed: true });
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

test('replays the original whitelist response after later mutations', async () => {
  const original = {
    id: 'list-1', userId: 'user-1', name: '学习', packages: ['com.reader'], isDefault: false, version: 1,
    createdAt: new Date('2026-07-27T01:00:00.000Z'), updatedAt: new Date('2026-07-27T01:00:00.000Z'), archivedAt: null,
  };
  const payload = { id: original.id, name: original.name, packages: original.packages };
  const fingerprint = createHash('sha256').update(JSON.stringify({ operation: 'create', payload })).digest('hex');
  const create = jest.fn(async () => ({ ...original, name: '不应再次创建' }));
  const prisma = {
    whitelistMutation: { findUnique: jest.fn(async () => ({
      userId: 'user-1', idempotencyKey: 'create-list-key', fingerprint,
      response: { ...original, createdAt: original.createdAt.toISOString(), updatedAt: original.updatedAt.toISOString() },
    })) },
    whitelistList: {
      findFirst: jest.fn(async ({ where }: { where: { isDefault?: boolean } }) => where.isDefault ? { ...original, id: 'default', isDefault: true } : null),
      create,
    },
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await expect(repository.createWhitelistList('user-1', payload, 'create-list-key')).resolves.toEqual({
    status: 'ok', value: original, replayed: true,
  });
  expect(create).not.toHaveBeenCalled();
});

test('rejects a reused whitelist key with a different payload', async () => {
  const originalPayload = { id: 'list-1', name: '学习', packages: ['com.reader'] };
  const fingerprint = createHash('sha256').update(JSON.stringify({ operation: 'create', payload: originalPayload })).digest('hex');
  const create = jest.fn(async () => ({ id: 'list-2' }));
  const prisma = {
    whitelistMutation: { findUnique: jest.fn(async () => ({
      userId: 'user-1', idempotencyKey: 'create-list-key', fingerprint, response: {},
    })) },
    whitelistList: {
      findFirst: jest.fn(async ({ where }: { where: { isDefault?: boolean } }) => where.isDefault ? { id: 'default', isDefault: true } : null),
      create,
    },
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await expect(repository.createWhitelistList('user-1', { ...originalPayload, name: '工作' }, 'create-list-key'))
    .resolves.toEqual({ status: 'idempotency-conflict' });
  expect(create).not.toHaveBeenCalled();
});

test('retries a serializable whitelist mutation after P2034', async () => {
  const list = {
    id: 'list-1', userId: 'user-1', name: '学习', packages: [], isDefault: false, version: 1,
    createdAt: new Date('2026-07-27T01:00:00.000Z'), updatedAt: new Date('2026-07-27T01:00:00.000Z'), archivedAt: null,
  };
  const updated = { ...list, isDefault: true, version: 2, updatedAt: new Date('2026-07-27T01:01:00.000Z') };
  const transaction = {
    whitelistMutation: { findUnique: jest.fn(async () => null), create: jest.fn(async () => undefined) },
    whitelistList: {
      findFirst: jest.fn(async () => list),
      updateMany: jest.fn(async () => ({ count: 1 })),
      update: jest.fn(async () => updated),
    },
  };
  const serializationFailure = new Prisma.PrismaClientKnownRequestError('write conflict', {
    code: 'P2034', clientVersion: 'test',
  });
  const runTransaction = jest.fn()
    .mockRejectedValueOnce(serializationFailure)
    .mockImplementationOnce(async (callback: (client: typeof transaction) => unknown) => callback(transaction));
  const prisma = {
    whitelistMutation: { findUnique: jest.fn(async () => null) },
    whitelistList: { findFirst: jest.fn(async () => null) },
    $transaction: runTransaction,
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await expect(repository.setDefaultWhitelistList('user-1', list.id, 1, 'default-list-key'))
    .resolves.toMatchObject({ status: 'ok', value: { id: list.id, isDefault: true, version: 2 } });
  expect(runTransaction).toHaveBeenCalledTimes(2);
});

test('stops retrying a serializable whitelist mutation after three P2034 failures', async () => {
  const serializationFailure = new Prisma.PrismaClientKnownRequestError('write conflict', {
    code: 'P2034', clientVersion: 'test',
  });
  const runTransaction = jest.fn().mockRejectedValue(serializationFailure);
  const prisma = {
    whitelistMutation: { findUnique: jest.fn(async () => null) },
    $transaction: runTransaction,
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await expect(repository.setDefaultWhitelistList('user-1', 'list-1', 1, 'default-list-key'))
    .rejects.toBe(serializationFailure);
  expect(runTransaction).toHaveBeenCalledTimes(3);
});

test('archives a referenced whitelist list by transactionally redirecting tasks to the replacement', async () => {
  const archivedAt = new Date('2026-07-26T00:00:00.000Z');
  jest.useFakeTimers().setSystemTime(archivedAt);
  const source = { id: 'source', userId: 'user-1', version: 4, isDefault: true, archivedAt: null };
  const replacement = { id: 'replacement', userId: 'user-1', version: 2, isDefault: false, archivedAt: null };
  const transaction = {
    whitelistList: {
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) => where.id === source.id ? source : replacement),
      count: jest.fn(async () => 2),
      updateMany: jest.fn(async () => ({ count: 1 })),
      update: jest.fn(async ({ where }: { where: { id: string } }) => ({ ...(where.id === source.id ? source : replacement), archivedAt, version: where.id === source.id ? 5 : 3 })),
    },
    task: { count: jest.fn(async () => 2), updateMany: jest.fn(async () => ({ count: 2 })) },
  };
  const prisma = { whitelistList: { findFirst: jest.fn(async () => null) }, $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)) };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  const result = await (repository as any).archiveWhitelistList('user-1', source.id, 4, replacement.id, 'archive-source-key');

  expect(result.status).toBe('ok');
  expect(transaction.task.updateMany).toHaveBeenCalledWith({
    where: { userId: 'user-1', whitelistListId: source.id },
    data: { whitelistListId: replacement.id, version: { increment: 1 } },
  });
  expect(transaction.whitelistList.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { userId: 'user-1', isDefault: true, archivedAt: null },
    data: { isDefault: false },
  }));
  expect(transaction.whitelistList.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: replacement.id }, data: { isDefault: true, version: { increment: 1 } },
  }));
  jest.useRealTimers();
});

test('requires a replacement before archiving a referenced whitelist list', async () => {
  const transaction = {
    whitelistList: {
      findFirst: jest.fn(async () => ({ id: 'source', userId: 'user-1', version: 1, isDefault: false, archivedAt: null })),
      count: jest.fn(async () => 2),
    },
    task: { count: jest.fn(async () => 1) },
  };
  const prisma = { whitelistList: { findFirst: jest.fn(async () => null) }, $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)) };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  await expect((repository as any).archiveWhitelistList('user-1', 'source', 1, undefined, 'archive-source-key')).resolves.toEqual({ status: 'replacement-required' });
});

test('always includes the active default whitelist in an incremental snapshot', async () => {
  const defaultList = {
    id: 'default', userId: 'user-1', name: '默认白名单', packages: [], isDefault: true,
    version: 1, archivedAt: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  };
  const whitelistFindMany = jest.fn(async () => [defaultList]);
  const prisma = {
    whitelistList: { findFirst: jest.fn(async () => defaultList), findMany: whitelistFindMany },
    taskCategory: { findMany: jest.fn(async () => []) },
    task: { findMany: jest.fn(async () => []) },
    focusSession: { findMany: jest.fn(async () => []) },
  };
  const repository = new PrismaTaskFocusRepository(prisma as never);

  const snapshot = await repository.sync('user-1', new Date('2026-07-01'));

  expect(snapshot.whitelistLists).toEqual([expect.objectContaining({ id: 'default', isDefault: true })]);
  expect(whitelistFindMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ OR: expect.arrayContaining([
      expect.objectContaining({ isDefault: true, archivedAt: null }),
    ]) }),
  }));
});
