jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: jest.fn(() => null),
}));

import { nativeDeviceUsageModule } from '../native-device-usage';

test('degrades safely when the native usage module is absent', async () => {
  await expect(nativeDeviceUsageModule.getUsageAccessStatus()).resolves.toBe('unsupported');
  await expect(nativeDeviceUsageModule.openUsageAccessSettings()).resolves.toBeUndefined();
  await expect(nativeDeviceUsageModule.queryAppUsage(1_000, 2_000)).resolves.toEqual({ apps: [], events: [] });
});
