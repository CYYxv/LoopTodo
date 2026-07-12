import { serverOutcome } from '../sync-api.client';

test('preserves lock emergency exits for server scoring', () => {
  expect(serverOutcome('exited', 'lock')).toBe('emergency_exit');
  expect(serverOutcome('exited', 'focus')).toBe('cancelled');
});
