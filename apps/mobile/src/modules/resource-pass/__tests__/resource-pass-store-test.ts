import { createResourcePassStore } from '../resource-pass.store';
import type { ResourcePassRepository } from '../resource-pass.repository';

describe('resource pass store loading', () => {
  test('loads each task once until explicitly refreshed', async () => {
    const list = jest.fn(async () => []);
    const repository = { list, create: jest.fn(), remove: jest.fn() } as unknown as ResourcePassRepository;
    const store = createResourcePassStore(repository);

    await Promise.all([store.getState().load('task'), store.getState().load('task')]);
    await store.getState().load('task');

    expect(list).toHaveBeenCalledTimes(1);
    expect(store.getState().loadStateByTask.task).toBe('loaded');

    await store.getState().load('task', true);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
