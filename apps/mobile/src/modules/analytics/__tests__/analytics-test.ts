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
