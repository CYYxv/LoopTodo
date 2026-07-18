import { fireEvent, render } from '@testing-library/react-native';

import { whitelistStore } from '@/modules/focus-session/whitelist.store';
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
};

test('offers system, light and dark theme choices through settings sync', async () => {
  const update = jest.fn(async () => undefined);
  settingsStore.setState({ configured: false, value: settings, error: null, update });
  lockEngineStore.setState({ refresh: jest.fn(async () => undefined) });
  whitelistStore.setState({
    selected: [], apps: [], loadingApps: false, hydrated: true, error: null,
    hydrate: jest.fn(async () => undefined),
  });

  const screen = await render(<SettingsPanel />);

  expect(screen.getAllByText('跟随系统').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('浅色')).toBeTruthy();
  expect(screen.getByText('深色')).toBeTruthy();

  await fireEvent.press(screen.getByText('浅色'));

  expect(update).toHaveBeenCalledWith({ themePreference: 'light' });
});
