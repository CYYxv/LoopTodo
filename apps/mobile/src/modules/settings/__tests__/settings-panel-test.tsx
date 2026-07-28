import { fireEvent, render } from '@testing-library/react-native';

import { lockEngineStore } from '@/modules/lock-engine/lock-engine.store';

import { SettingsPanel } from '../components/SettingsPanel';
import { settingsStore, type Settings } from '../settings.store';

const settings: Settings = {
  multiDeviceFocusSync: false,
  bottomTabs: ['habits', 'statistics'],
  themePreference: 'system',
  shareCurrentTask: false,
  shareCompletedTasks: false,
  networkPolicy: 'offline_first',
  taskRemindersEnabled: true,
  familyAlertsEnabled: true,
  rewardNotificationsEnabled: true,
  isMinor: false,
  birthYear: null,
};

test('offers system, light and dark theme choices through settings sync', async () => {
  const update = jest.fn(async () => undefined);
  settingsStore.setState({ configured: false, value: settings, error: null, update });
  lockEngineStore.setState({ refresh: jest.fn(async () => undefined) });
  const screen = await render(<SettingsPanel />);

  expect(screen.getAllByText('跟随系统').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('浅色')).toBeTruthy();
  expect(screen.getByText('深色')).toBeTruthy();

  await fireEvent.press(screen.getByText('浅色'));

  expect(update).toHaveBeenCalledWith({ themePreference: 'light' });
});

test('uses whitelist permissions without exposing the removed accessibility flow', async () => {
  const open = jest.fn(async () => undefined);
  settingsStore.setState({ configured: false, value: settings, error: null });
  lockEngineStore.setState({
    open,
    capabilities: {
      manufacturer: 'Xiaomi', sdkInt: 35, usageAccess: { supported: true, effective: false, reason: '未开启' },
      overlay: { supported: true, effective: false, reason: '未开启' }, backgroundLaunch: { supported: true, effective: false, reason: '未开启' },
    } as never,
  });

  const screen = await render(<SettingsPanel />);

  expect(screen.queryByText(/无障碍/)).toBeNull();
  expect(screen.queryByText('专注应用白名单')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '使用情况访问' }));
  await fireEvent.press(screen.getByRole('button', { name: '显示在其他应用上层' }));
  expect(open).toHaveBeenNthCalledWith(1, 'usageAccess');
  expect(open).toHaveBeenNthCalledWith(2, 'overlay');
});
