import { formatDuration } from '../focus-session.utils';

describe('formatDuration', () => {
  test.each([
    [0, '0:00'],
    [5, '0:05'],
    [60, '1:00'],
    [1500, '25:00'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
