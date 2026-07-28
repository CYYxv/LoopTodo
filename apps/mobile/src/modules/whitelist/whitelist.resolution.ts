import type { RestrictionMode, SessionRestrictionSnapshot, WhitelistList, WhitelistMode } from './whitelist.types';

type RestrictionTask = {
  restrictionMode: RestrictionMode;
  whitelistMode: WhitelistMode;
  whitelistListId: string | null;
  whitelistPackages: string[];
};

export function resolveTaskRestriction({
  task,
  lists,
  launchablePackages,
}: {
  task: RestrictionTask;
  lists: WhitelistList[];
  launchablePackages: string[];
}): SessionRestrictionSnapshot {
  if (task.restrictionMode !== 'whitelist') {
    return {
      restrictionMode: task.restrictionMode,
      whitelistSource: task.restrictionMode === 'strict' ? 'strict' : 'none',
      restrictionEffective: task.restrictionMode === 'none',
      allowedPackagesSnapshot: [],
    };
  }
  const selectedList = task.whitelistMode === 'list'
    ? lists.find((list) => list.id === task.whitelistListId) ?? lists.find((list) => list.isDefault)
    : null;
  const packages = task.whitelistMode === 'custom' ? task.whitelistPackages : selectedList?.packages ?? [];
  const launchable = new Set(launchablePackages);
  return {
    restrictionMode: task.restrictionMode,
    whitelistSource: task.whitelistMode === 'custom'
      ? 'custom'
      : `list:${selectedList?.id ?? task.whitelistListId ?? 'missing'}`,
    restrictionEffective: false,
    allowedPackagesSnapshot: [...new Set(packages.map((value) => value.trim()).filter((value) => value && launchable.has(value)))],
  };
}
