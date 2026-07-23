import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { SocialService } from './social.service';

function createService(prisma: Record<string, unknown>) {
  return new SocialService(prisma as never, { getClient: async () => ({}) } as never);
}

describe('SocialService safety', () => {
  test('removeFriend deletes only when user is a party', async () => {
    const deleted: string[] = [];
    const service = createService({
      friendship: {
        async findFirst(query: { where: { id: string } }) {
          if (query.where.id === 'f1') return { id: 'f1', requesterId: 'u1', addresseeId: 'u2' };
          return null;
        },
        async delete(query: { where: { id: string } }) {
          deleted.push(query.where.id);
          return { id: query.where.id };
        },
      },
    });

    await expect(service.removeFriend('u1', 'f1')).resolves.toEqual({ id: 'f1', removed: true });
    expect(deleted).toEqual(['f1']);
    await expect(service.removeFriend('u3', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('blockFriend sets blocked status and respondedAt', async () => {
    const updates: unknown[] = [];
    const prisma = {
      friendship: {
        async findFirst() {
          return { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'accepted' };
        },
        async update(args: unknown) {
          updates.push(args);
          return { id: 'f1', status: 'blocked' };
        },
        async findUniqueOrThrow() {
          return { id: 'f1', status: 'blocked' };
        },
      },
      userBlock: {
        async upsert(args: unknown) {
          updates.push(args);
          return { id: 'b1' };
        },
      },
      async $transaction(ops: Promise<unknown>[]) {
        return Promise.all(ops);
      },
    };
    const service = new SocialService(prisma as never, {} as never);
    const result = await service.blockFriend('u1', 'f1');
    expect(result.status).toBe('blocked');
    expect(updates.length).toBeGreaterThanOrEqual(2);
  });

  test('reportUser rejects self/empty and records SecurityEvent', async () => {
    const events: unknown[] = [];
    const service = createService({
      securityEvent: {
        async create(query: { data: unknown }) {
          events.push(query.data);
          return query.data;
        },
      },
    });

    await expect(service.reportUser('u1', 'u1', 'spam')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reportUser('u1', 'u2', '   ')).rejects.toBeInstanceOf(BadRequestException);

    await service.reportUser('u1', 'u2', '  骚扰内容  ');
    expect(events[0]).toMatchObject({
      actorId: 'u1',
      category: 'social',
      action: 'user_report',
      outcome: 'recorded',
      metadata: { targetUserId: 'u2', reason: '骚扰内容' },
    });
  });

  test('removeFriend rejects blocked friendships', async () => {
    const service = createService({
      friendship: {
        async findFirst() { return { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'blocked' }; },
        async delete() { throw new Error('should not delete'); },
      },
    });
    await expect(service.removeFriend('u2', 'f1')).rejects.toBeInstanceOf(ConflictException);
  });

  test('inviteFriend rejects blocked pairs', async () => {
    const service = createService({
      user: {
        async findUnique() {
          return { id: 'u2' };
        },
      },
      userBlock: {
        async findFirst() {
          return null;
        },
      },
      friendship: {
        async findUnique() {
          return { id: 'f1', status: 'blocked' };
        },
      },
    });

    await expect(service.inviteFriend('u1', 'friend@example.com')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.inviteFriend('u1', 'friend@example.com')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FRIENDSHIP_BLOCKED' }),
    });
  });
});

test('inviteFriend rejects mutual UserBlock', async () => {
  const prisma = {
    user: {
      async findUnique() { return { id: 'u2', nickname: 'Bob' }; },
    },
    userBlock: {
      async findFirst() { return { id: 'b1', blockerId: 'u2', blockedId: 'u1' }; },
    },
    friendship: {
      async findUnique() { return null; },
    },
  };
  const service = new SocialService(prisma as never, {} as never);
  await expect(service.inviteFriend('u1', 'friend@example.com')).rejects.toMatchObject({
    response: expect.objectContaining({ code: 'USER_BLOCKED' }),
  });
});
