import { resolveTaskRestriction } from '../whitelist.resolution';
import type { WhitelistList } from '../whitelist.types';

const lists: WhitelistList[] = [
  { id: 'default', name: '默认名单', packages: ['com.reader', 'com.missing'], isDefault: true, version: 1, syncStatus: 'synced' },
  { id: 'music', name: '音乐', packages: ['com.music', 'com.reader'], isDefault: false, version: 2, syncStatus: 'synced' },
];

test('resolves default, selected, and custom packages against launchable apps', () => {
  expect(resolveTaskRestriction({ task: task({ whitelistListId: null }), lists, launchablePackages: ['com.reader', 'com.music'] }))
    .toEqual({ restrictionMode: 'whitelist', whitelistSource: 'list:default', restrictionEffective: false, allowedPackagesSnapshot: ['com.reader'] });
  expect(resolveTaskRestriction({ task: task({ whitelistListId: 'music' }), lists, launchablePackages: ['com.reader', 'com.music'] }))
    .toEqual({ restrictionMode: 'whitelist', whitelistSource: 'list:music', restrictionEffective: false, allowedPackagesSnapshot: ['com.music', 'com.reader'] });
  expect(resolveTaskRestriction({ task: task({ whitelistMode: 'custom', whitelistPackages: ['com.music', 'com.hidden'] }), lists, launchablePackages: ['com.music'] }))
    .toEqual({ restrictionMode: 'whitelist', whitelistSource: 'custom', restrictionEffective: false, allowedPackagesSnapshot: ['com.music'] });
});

test('keeps empty whitelist and strict restrictions active', () => {
  expect(resolveTaskRestriction({ task: task({ whitelistListId: 'missing' }), lists: [], launchablePackages: ['com.music'] }))
    .toEqual({ restrictionMode: 'whitelist', whitelistSource: 'list:missing', restrictionEffective: false, allowedPackagesSnapshot: [] });
  expect(resolveTaskRestriction({ task: task({ restrictionMode: 'strict' }), lists, launchablePackages: ['com.reader'] }))
    .toEqual({ restrictionMode: 'strict', whitelistSource: 'strict', restrictionEffective: false, allowedPackagesSnapshot: [] });
  expect(resolveTaskRestriction({ task: task({ restrictionMode: 'none' }), lists, launchablePackages: ['com.reader'] }))
    .toEqual({ restrictionMode: 'none', whitelistSource: 'none', restrictionEffective: true, allowedPackagesSnapshot: [] });
});

function task(overrides: Partial<{ restrictionMode: 'none' | 'whitelist' | 'strict'; whitelistMode: 'list' | 'custom'; whitelistListId: string | null; whitelistPackages: string[] }> = {}) {
  return { restrictionMode: 'whitelist' as const, whitelistMode: 'list' as const, whitelistListId: null, whitelistPackages: [], ...overrides };
}
