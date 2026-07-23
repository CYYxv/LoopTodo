import { resolveTaskWhitelistPackages } from '../task.whitelist';

test('inherit uses global packages', () => {
  expect(resolveTaskWhitelistPackages({ whitelistMode: 'inherit', whitelistPackages: ['a'] }, ['b', 'c'])).toEqual(['b', 'c']);
});

test('custom uses task packages only', () => {
  expect(resolveTaskWhitelistPackages({ whitelistMode: 'custom', whitelistPackages: ['x', '', 'y'] }, ['b'])).toEqual(['x', 'y']);
});
