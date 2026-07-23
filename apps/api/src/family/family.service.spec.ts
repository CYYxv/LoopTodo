import { FamilyService } from './family.service';

describe('FamilyService task assignment', () => {
  function setup() {
    const taskCreate = jest.fn(async ({ data }) => ({ id: 'task-1', ...data }));
    const forcedRuleCreate = jest.fn(async ({ data }) => data);
    const prisma = {
      familyMember: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'parent-member', role: 'parent' })
          .mockResolvedValueOnce({ id: 'child-member', userId: 'child-user', role: 'child' }),
      },
      subscription: { findFirst: jest.fn(async () => ({ id: 'subscription-1' })) },
      $transaction: async (run: (transaction: unknown) => Promise<unknown>) => run({
        task: { create: taskCreate },
        familyTaskAssignment: { create: jest.fn(async ({ data }) => ({ id: 'assignment-1', ...data })) },
        forcedLockRule: { create: forcedRuleCreate },
      }),
    };
    const service = new FamilyService(prisma as never, {} as never, {} as never, {} as never, { record: jest.fn() } as never);
    return { service, taskCreate, forcedRuleCreate };
  }

  test('rejects a required family task without a trigger time', async () => {
    const { service } = setup();

    await expect(service.assignTask('parent-user', 'group-1', {
      childUserId: 'child-user', title: '晚间复习', taskType: 'pomodoro', timerMode: 'countdown',
      estimatedMinutes: 25, restMinutes: 5, isTodayRequired: true,
    })).rejects.toMatchObject({ response: { code: 'FORCED_TRIGGER_TIME_REQUIRED' } });
  });

  test('stores the trigger time on both the task and lock rule', async () => {
    const { service, taskCreate, forcedRuleCreate } = setup();

    await service.assignTask('parent-user', 'group-1', {
      childUserId: 'child-user', title: '晚间复习', taskType: 'pomodoro', timerMode: 'countdown',
      estimatedMinutes: 25, restMinutes: 5, isTodayRequired: true, triggerTime: '20:00',
    });

    expect(taskCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      isTodayRequired: true, forcedTriggerTime: '20:00',
    }) });
    expect(forcedRuleCreate).toHaveBeenCalled();
  });
});

describe('FamilyService task change review', () => {
  function setup(proposedPatch: Record<string, unknown>) {
    const taskUpdate = jest.fn(async ({ data }) => data);
    const prisma = {
      taskChangeRequest: { findUnique: jest.fn(async () => ({
        id: 'request-1', status: 'pending', requestType: 'update', proposedPatch,
        assignmentId: 'assignment-1', assignment: { id: 'assignment-1', taskId: 'task-1', familyGroupId: 'group-1' },
      })) },
      familyMember: { findFirst: jest.fn(async () => ({ id: 'parent-member', role: 'parent' })) },
      subscription: { findFirst: jest.fn(async () => ({ id: 'subscription-1' })) },
      $transaction: async (run: (transaction: unknown) => Promise<unknown>) => run({
        task: {
          findUniqueOrThrow: jest.fn(async () => ({
            id: 'task-1', userId: 'child-user', activeSessionId: null, isTodayRequired: false,
            forcedTriggerTime: null,
          })),
          update: taskUpdate,
        },
        taskChangeRequest: { update: jest.fn(async ({ data }) => data) },
      }),
    };
    const service = new FamilyService(prisma as never, {} as never, {} as never, {} as never, { record: jest.fn() } as never);
    return { service, taskUpdate };
  }

  test('rejects enabling required mode without a trigger time', async () => {
    const { service } = setup({ isTodayRequired: true });

    await expect(service.reviewChange('parent-user', 'request-1', 'approved'))
      .rejects.toMatchObject({ response: { code: 'FORCED_TRIGGER_TIME_REQUIRED' } });
  });

  test('stores the approved trigger time on the task', async () => {
    const { service, taskUpdate } = setup({ isTodayRequired: true, triggerTime: '20:00' });

    await service.reviewChange('parent-user', 'request-1', 'approved');

    expect(taskUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      isTodayRequired: true, forcedTriggerTime: '20:00',
    }) }));
  });
});


describe('FamilyService leave/status membership', () => {
  test('status throws when parent has left (findFirst returns null)', async () => {
    const security = { record: jest.fn() };
    const prisma = {
      familyMember: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new FamilyService(prisma as never, {} as never, {} as never, {} as never, security as never);

    await expect(service.status('parent-user', 'child-user'))
      .rejects.toMatchObject({ response: { code: 'FAMILY_STATUS_FORBIDDEN' } });
    expect(security.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'family_status_read',
      outcome: 'denied',
    }));
  });

  test('leave records member_leave security audit', async () => {
    const security = { record: jest.fn() };
    const prisma = {
      familyMember: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new FamilyService(prisma as never, {} as never, {} as never, {} as never, security as never);

    await expect(service.leave('user-1', 'group-1')).resolves.toEqual({ left: true });
    expect(security.record).toHaveBeenCalledWith(expect.objectContaining({
      category: 'family',
      action: 'member_leave',
      outcome: 'success',
      targetType: 'family_group',
      targetId: 'group-1',
    }));
  });
});
