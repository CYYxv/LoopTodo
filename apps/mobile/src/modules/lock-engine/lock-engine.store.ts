import * as SecureStore from 'expo-secure-store';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createNativeLockEngine } from './native-lock-engine';
import type { LockEngine } from './lock-engine.port';
import type { LockCapabilities } from './lock-engine.types';
import { fetchEmergencyQuota } from './emergency-quota.client';

type LockEngineStore = {
  capabilities: LockCapabilities | null;
  serverEmergencyRemaining: number | null;
  error: string | null;
  refresh(): Promise<void>;
  refreshServerQuota(baseUrl: string): Promise<void>;
  confirmRisk(): Promise<void>;
  open(kind: 'notifications' | 'notificationListener' | 'accessibility' | 'battery' | 'exactAlarm' | 'vendorBackground'): Promise<void>;
};

export function createLockEngineStore(engine: LockEngine) {
  return createStore<LockEngineStore>((set, get) => ({
    capabilities: null,
    serverEmergencyRemaining: null,
    error: null,
    async refresh() {
      try {
        const capabilities = await engine.checkCapabilities();
        const serverRemaining = get().serverEmergencyRemaining;
        set({
          capabilities: serverRemaining == null
            ? capabilities
            : {
                ...capabilities,
                emergencyExitsRemaining: Math.min(capabilities.emergencyExitsRemaining, serverRemaining),
              },
          error: null,
        });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '锁机能力检查失败' });
      }
    },
    async refreshServerQuota(baseUrl) {
      try {
        const token = await SecureStore.getItemAsync('looptodo.access-token');
        if (!token || !baseUrl) return;
        const quota = await fetchEmergencyQuota(baseUrl, token);
        const capabilities = get().capabilities;
        set({
          serverEmergencyRemaining: quota.remaining,
          ...(capabilities
            ? {
                capabilities: {
                  ...capabilities,
                  emergencyExitsRemaining: Math.min(capabilities.emergencyExitsRemaining, quota.remaining),
                },
              }
            : {}),
        });
      } catch {
        // offline: keep local native remaining
      }
    },
    async confirmRisk() {
      try {
        await engine.confirmRiskAcknowledgement();
        await get().refresh();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '风险确认失败' });
      }
    },
    async open(kind) {
      try {
        await engine.openPermissionSettings(kind);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '无法打开系统设置' });
      }
    },
  }));
}

export const lockEngine = createNativeLockEngine();
export const lockEngineStore = createLockEngineStore(lockEngine);
export function useLockEngineStore<T>(selector: (state: LockEngineStore) => T) {
  return useStore(lockEngineStore, selector);
}
