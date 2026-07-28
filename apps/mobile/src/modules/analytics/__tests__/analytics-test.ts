import { clearAnalyticsEvents, getAnalyticsEvents, track } from '../analytics';

beforeEach(() => {
  clearAnalyticsEvents();
});

test('tracks events in a ring buffer of 100', () => {
  for (let i = 0; i < 105; i += 1) {
    track('task_create', { i });
  }
  const events = getAnalyticsEvents();
  expect(events).toHaveLength(100);
  expect(events[0]?.props).toEqual({ i: 5 });
  expect(events[99]?.props).toEqual({ i: 104 });
});

test('removes software identity and classification fields from whitelist analytics', () => {
  track('whitelist_saved', {
    source: 'task',
    selectedCount: 2,
    packageName: 'com.example.private',
    packages: ['com.example.private'],
    appName: 'Private App',
    appCategory: 'social',
    riskyCount: 1,
  });

  expect(getAnalyticsEvents()[0]?.props).toEqual({
    source: 'task',
    selectedCount: 2,
  });
});

test('keeps only the PRD 3.15 whitelist lifecycle properties', () => {
  track('whitelist_list_deleted', {
    listId: 'study', source: 'settings', selectedCount: 3, isDefault: false, affectedTaskCount: 2,
    packageName: 'private.package', appName: 'Private App', riskCategory: 'high',
  });

  expect(getAnalyticsEvents()[0]?.props).toEqual({
    listId: 'study', affectedTaskCount: 2,
  });
});
