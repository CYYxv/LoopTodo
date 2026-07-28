import { PrismaScoringRepository } from './prisma-scoring.repository';

describe('PrismaScoringRepository', () => {
  test('getSession selects the restriction settlement snapshot', async () => {
    let query: unknown;
    const prisma = {
      focusSession: {
        async findFirst(input: unknown) {
          query = input;
          return null;
        },
      },
    };
    const repository = new PrismaScoringRepository(prisma as never);

    await repository.getSession('user', 'session');

    expect(query).toEqual({
      where: { id: 'session', userId: 'user' },
      select: {
        id: true,
        userId: true,
        mode: true,
        timerMode: true,
        trustLevel: true,
        endedAt: true,
        actualMinutes: true,
        restrictionMode: true,
        whitelistSource: true,
        whitelistPackageCount: true,
        restrictionEffective: true,
        effectiveMinutes: true,
        outcome: true,
      },
    });
  });
});
