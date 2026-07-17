import { createHttpSyncClient } from '../sync-api.client';

test('sends task edits through the task update endpoint', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: {} }) } as Response);
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
  fetchMock.mockRestore();
});
