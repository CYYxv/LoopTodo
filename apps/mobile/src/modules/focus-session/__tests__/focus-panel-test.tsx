import { render } from '@testing-library/react-native';

import type { LockCapabilities } from '@/modules/lock-engine/lock-engine.types';
import { FocusPanel } from '../components/FocusPanel';

test('renders with capabilities returned by an older development build', () => {
  const legacyCapabilities = {
    supported: true,
    manufacturer: 'xiaomi',
    sdkInt: 36,
    vendorBackgroundSettingsAvailable: true,
    notificationGranted: true,
    notificationListenerEnabled: true,
    accessibilityEnabled: false,
    batteryOptimizationIgnored: true,
    riskConfirmed: true,
    emergencyExitsRemaining: 2,
    exactAlarmAllowed: true,
  } as unknown as LockCapabilities;

  expect(() => render(<FocusPanel
    selectedMode="focus"
    strictOptions={[{ id: 'recents', label: '隐藏最近任务', description: '测试', enabled: false, capabilityKey: 'hideRecents' }]}
    selectedTask={null}
    onModeChange={jest.fn()}
    onStrictOptionToggle={jest.fn()}
    onStart={jest.fn()}
    lockCapabilities={legacyCapabilities}
    onRefreshLockCapabilities={jest.fn()}
    onConfirmLockRisk={jest.fn()}
    onOpenLockPermission={jest.fn()}
  />)).not.toThrow();
});

test('does not expose the removed advanced resource feature', async () => {
  const screen = await render(<FocusPanel
    selectedMode="focus"
    strictOptions={[]}
    selectedTask={null}
    onModeChange={jest.fn()}
    onStrictOptionToggle={jest.fn()}
    onStart={jest.fn()}
    lockCapabilities={null}
    onRefreshLockCapabilities={jest.fn()}
    onConfirmLockRisk={jest.fn()}
    onOpenLockPermission={jest.fn()}
  />);

  expect(screen.queryByText('专注资料与 AI（高级）')).toBeNull();
  expect(screen.queryByText(/可信/)).toBeNull();
  expect(screen.getByText('开始专注')).toBeTruthy();
});

test('does not expose the removed accessibility enhancement', async () => {
  const screen = await render(<FocusPanel
    selectedMode="lock"
    strictOptions={[]}
    selectedTask={null}
    onModeChange={jest.fn()}
    onStrictOptionToggle={jest.fn()}
    onStart={jest.fn()}
    lockCapabilities={{
      supported: true, manufacturer: 'xiaomi', sdkInt: 36, vendorBackgroundSettingsAvailable: true,
      notificationGranted: true, notificationListenerEnabled: true, accessibilityEnabled: false,
      batteryOptimizationIgnored: true, riskConfirmed: true, emergencyExitsRemaining: 2, exactAlarmAllowed: true,
      restrictions: {} as LockCapabilities['restrictions'],
    }}
    onRefreshLockCapabilities={jest.fn()}
    onConfirmLockRisk={jest.fn()}
    onOpenLockPermission={jest.fn()}
  />);

  expect(screen.queryByText(/增强约束/)).toBeNull();
});
