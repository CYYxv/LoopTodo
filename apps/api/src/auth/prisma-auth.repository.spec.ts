import { PrismaAuthRepository } from './prisma-auth.repository';

test('creates the user default whitelist list in the registration transaction', async () => {
  const user = { id: 'user-1', email: 'user@example.com' };
  const transaction = {
    user: { create: jest.fn(async () => user) },
    deviceSession: { create: jest.fn(async () => undefined) },
    whitelistList: { create: jest.fn(async () => undefined) },
  };
  const prisma = { $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)) };
  const repository = new PrismaAuthRepository(prisma as never);

  await repository.createUserWithSession({
    user: { id: user.id, email: user.email, passwordHash: 'hash', nickname: 'User' },
    session: { id: 'session-1', deviceName: 'Pixel', refreshTokenHash: 'refresh', expiresAt: new Date('2026-08-01T00:00:00.000Z') },
  });

  expect(transaction.whitelistList.create).toHaveBeenCalledWith({
    data: { userId: user.id, name: '默认白名单', packages: [], isDefault: true },
  });
});
