import { render } from '@testing-library/react-native';

import MeRoute from '../../../app/(tabs)/me';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/modules/whitelist/components/WhitelistManager', () => ({ WhitelistManager: () => null }));
jest.mock('heroui-native/avatar', () => {
  const { Text, View } = jest.requireActual('react-native');
  const Avatar = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Avatar.Fallback = ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>;
  return { Avatar };
});
jest.setTimeout(15_000);

test('describes software whitelist management as reusable scene settings', async () => {
  const screen = await render(<MeRoute />);

  expect(screen.getByText('管理不同场景下允许使用的软件')).toBeTruthy();
  expect(screen.queryByText('管理任务可使用的应用名单')).toBeNull();
});
