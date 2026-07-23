import type { Task } from './task.types';

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
