import type { Task } from './task.types';
import type { RestrictionMode, WhitelistMode } from '@/modules/whitelist/whitelist.types';

type RestrictionInput = {
  restrictionMode?: RestrictionMode | null;
  whitelistMode?: WhitelistMode | 'inherit' | null;
  whitelistListId?: string | null;
  whitelistPackages?: string[] | null;
};

export function normalizeTaskRestriction(input: RestrictionInput) {
  const restrictionMode: RestrictionMode = input.restrictionMode ?? 'whitelist';
  const whitelistMode: WhitelistMode = input.whitelistMode === 'custom' ? 'custom' : 'list';
  if (restrictionMode !== 'whitelist') {
    return { restrictionMode, whitelistMode, whitelistListId: null, whitelistPackages: [] };
  }
  return {
    restrictionMode,
    whitelistMode,
    whitelistListId: whitelistMode === 'list' ? input.whitelistListId ?? null : null,
    whitelistPackages: whitelistMode === 'custom' ? normalizePackages(input.whitelistPackages) : [],
  };
}

/** Resolve packages applied when focus whitelist restriction is enabled. */
export function resolveTaskWhitelistPackages(
  task: Pick<Task, 'whitelistMode' | 'whitelistPackages'>,
  globalPackages: string[],
): string[] {
  if (task.whitelistMode === 'custom') {
    return task.whitelistPackages.filter((pkg) => pkg.trim().length > 0);
  }
  return globalPackages.filter((pkg) => pkg.trim().length > 0);
}

function normalizePackages(packages: string[] | null | undefined) {
  return [...new Set((packages ?? []).map((item) => item.trim()).filter(Boolean))];
}
