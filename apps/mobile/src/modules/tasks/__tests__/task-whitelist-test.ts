import { normalizeTaskRestriction } from '../task.whitelist';

test('normalizes legacy inherit and custom modes into the canonical whitelist contract', () => {
  expect(normalizeTaskRestriction({ whitelistMode: 'inherit', whitelistPackages: ['ignored'] })).toEqual({
    restrictionMode: 'whitelist', whitelistMode: 'list', whitelistListId: null, whitelistPackages: [],
  });
  expect(normalizeTaskRestriction({ whitelistMode: 'custom', whitelistPackages: ['x', '', 'x', 'y'] })).toEqual({
    restrictionMode: 'whitelist', whitelistMode: 'custom', whitelistListId: null, whitelistPackages: ['x', 'y'],
  });
});

test('clears list data outside whitelist mode', () => {
  expect(normalizeTaskRestriction({ restrictionMode: 'strict', whitelistMode: 'custom', whitelistListId: 'list-1', whitelistPackages: ['x'] })).toEqual({
    restrictionMode: 'strict', whitelistMode: 'custom', whitelistListId: null, whitelistPackages: [],
  });
});
