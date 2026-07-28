import { prototypeStrictOptions } from '../prototype.data';

test('describes app restrictions without accessibility permission', () => {
  const copy = prototypeStrictOptions
    .flatMap((option) => [option.label, option.description, option.unavailableReason ?? ''])
    .join(' ');

  expect(copy).not.toContain('无障碍');
  expect(prototypeStrictOptions.find((option) => option.id === 'whitelist')?.description)
    .toContain('使用情况访问');
});
