import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createNativeLockEngine } from './native-lock-engine';
import type { LockEngine } from './lock-engine.port';
import type { LockCapabilities } from './lock-engine.types';

type LockEngineStore = { capabilities: LockCapabilities | null; error: string | null; refresh(): Promise<void>; confirmRisk(): Promise<void>; open(kind: 'notifications' | 'notificationListener' | 'accessibility' | 'battery' | 'exactAlarm' | 'vendorBackground'): Promise<void> };
export function createLockEngineStore(engine: LockEngine) {
  return createStore<LockEngineStore>((set, get) => ({ capabilities: null, error: null,
    async refresh() { try { set({ capabilities: await engine.checkCapabilities(), error: null }); } catch (error) { set({ error: message(error) }); } },
    async confirmRisk() { try { await engine.confirmRisk(); await get().refresh(); } catch (error) { set({ error: message(error) }); } },
    async open(kind) { try { await engine.openPermissionSettings(kind); } catch (error) { set({ error: message(error) }); } },
  }));
}
export const lockEngine = createNativeLockEngine();
export const lockEngineStore = createLockEngineStore(lockEngine);
export function useLockEngineStore<T>(selector: (state: LockEngineStore) => T) { return useStore(lockEngineStore, selector); }
function message(error: unknown) { return error instanceof Error ? error.message : '锁机权限检查失败'; }
