import { loopTodoPalettes, normalizeResolvedTheme } from '../theme';

test('normalizes every non-dark runtime theme to light', () => {
  expect(normalizeResolvedTheme('light')).toBe('light');
  expect(normalizeResolvedTheme('dark')).toBe('dark');
  expect(normalizeResolvedTheme('unknown')).toBe('light');
});

test('provides fixed blue semantic palettes for light and dark modes', () => {
  expect(loopTodoPalettes.light.accent).toBe('#2563EB');
  expect(loopTodoPalettes.dark.accent).toBe('#5B8CFF');
  expect(loopTodoPalettes.light.background).toBe('#F6F7F9');
  expect(loopTodoPalettes.dark.background).toBe('#101114');
});
