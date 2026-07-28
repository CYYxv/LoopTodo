import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import type { SyncStatus } from '@/modules/tasks/task.types';

export type RestrictionMode = 'none' | 'whitelist' | 'strict';
export type WhitelistMode = 'list' | 'custom';
export type WhitelistSource = 'none' | 'strict' | 'custom' | `list:${string}`;

export type WhitelistList = {
  id: string;
  name: string;
  packages: string[];
  isDefault: boolean;
  version: number;
  syncStatus: SyncStatus;
  archivedAt?: number | null;
};

export type SessionRestrictionSnapshot = {
  restrictionMode: RestrictionMode;
  whitelistSource: WhitelistSource;
  restrictionEffective: boolean;
  allowedPackagesSnapshot: string[];
};

export type RestrictedActiveSession = ActiveSession & SessionRestrictionSnapshot;
