import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { NativeDeviceUsageModule } from './device-usage';

type AndroidUsageStatsModule = NativeDeviceUsageModule;

export const nativeDeviceUsageModule: NativeDeviceUsageModule = {
  async getUsageAccessStatus() {
    if (Platform.OS !== 'android') return 'unsupported';
    return nativeModule()?.getUsageAccessStatus() ?? 'unsupported';
  },
  async openUsageAccessSettings() {
    if (Platform.OS === 'android') await nativeModule()?.openUsageAccessSettings();
  },
  async queryAppUsage(startAt, endAt) {
    if (Platform.OS !== 'android') return { apps: [], events: [] };
    return nativeModule()?.queryAppUsage(startAt, endAt) ?? { apps: [], events: [] };
  },
};

function nativeModule() {
  return requireOptionalNativeModule<AndroidUsageStatsModule>('LoopTodoUsageStats');
}
