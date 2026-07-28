import type { WhitelistList } from './whitelist.types';

export interface WhitelistRepository {
  hydrate(): Promise<WhitelistList[]>;
  create(name: string, packages: string[]): Promise<WhitelistList>;
  update(list: WhitelistList, previousVersion: number): Promise<void>;
  setDefault(id: string, previousVersion: number): Promise<void>;
  countReferences(id: string): Promise<number>;
  archive(id: string, version: number, replacementId: string | null): Promise<void>;
}
