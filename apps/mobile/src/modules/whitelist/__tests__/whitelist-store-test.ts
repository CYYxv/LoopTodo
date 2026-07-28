import { createWhitelistStore } from '../whitelist.store';
import type { WhitelistList } from '../whitelist.types';
import { clearAnalyticsEvents, getAnalyticsEvents } from '@/modules/analytics/analytics';

beforeEach(() => clearAnalyticsEvents());

test('hydrates and refreshes multi-list CRUD state', async () => {
  let lists: WhitelistList[] = [{ id: 'default', name: '默认名单', packages: ['com.reader'], isDefault: true, version: 1, syncStatus: 'synced' }];
  const repository = {
    hydrate: jest.fn(async () => lists),
    create: jest.fn(async (name: string, packages: string[]) => {
      const list = { id: 'study', name, packages, isDefault: false, version: 1, syncStatus: 'pending' as const };
      lists = [...lists, list];
      return list;
    }),
    update: jest.fn(async () => undefined),
    setDefault: jest.fn(async () => undefined),
    countReferences: jest.fn(async () => 0),
    archive: jest.fn(async () => undefined),
  };
  const store = createWhitelistStore(repository);

  await store.getState().hydrate();
  await store.getState().create('学习', ['com.music']);

  expect(store.getState().lists.map((list) => list.id)).toEqual(['default', 'study']);
  expect(repository.create).toHaveBeenCalledWith('学习', ['com.music']);
});

test('reports a failed save so the editor can preserve its draft for retry', async () => {
  const list: WhitelistList = { id: 'study', name: '学习', packages: ['com.reader'], isDefault: false, version: 1, syncStatus: 'synced' };
  const repository = {
    hydrate: jest.fn(async () => [list]),
    create: jest.fn(async () => list),
    update: jest.fn(async () => { throw new Error('保存失败'); }),
    setDefault: jest.fn(async () => undefined),
    countReferences: jest.fn(async () => 0),
    archive: jest.fn(async () => undefined),
  };
  const store = createWhitelistStore(repository);
  await store.getState().hydrate();

  const saved = await store.getState().update({ ...list, name: '深度学习' });

  expect(saved).toBe(false);
  expect(store.getState().lists).toEqual([list]);
  expect(store.getState().error).toBe('保存失败');
});

test('tracks successful list lifecycle events with privacy-safe properties', async () => {
  const created: WhitelistList = { id: 'study', name: '学习', packages: ['com.reader'], isDefault: false, version: 1, syncStatus: 'pending' };
  const repository = {
    hydrate: jest.fn(async () => [created]),
    create: jest.fn(async () => created),
    update: jest.fn(async () => undefined),
    setDefault: jest.fn(async () => undefined),
    countReferences: jest.fn(async () => 2),
    archive: jest.fn(async () => undefined),
  };
  const store = createWhitelistStore(repository);

  await store.getState().create('学习', ['com.reader']);
  await store.getState().update(created);
  await store.getState().archive(created, 'default', 2);

  expect(getAnalyticsEvents().map(({ event, props }) => ({ event, props }))).toEqual([
    { event: 'whitelist_list_created', props: { listId: 'study', selectedCount: 1 } },
    { event: 'whitelist_list_updated', props: { listId: 'study', selectedCount: 1, isDefault: false } },
    { event: 'whitelist_list_deleted', props: { listId: 'study', affectedTaskCount: 2 } },
  ]);
});
