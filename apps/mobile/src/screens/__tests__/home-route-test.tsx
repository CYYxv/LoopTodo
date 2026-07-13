import { render } from '@testing-library/react-native';
import { authStore } from '@/modules/auth/auth.store';
import IndexRoute from '../../../app/index';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return { Redirect: ({ href }: { href: string }) => <Text>{href}</Text> };
});

describe('root route authentication gate', () => {
  test('redirects signed-out users to login', async () => {
    authStore.setState({ status: 'signed_out', user: null });
    const screen = await render(<IndexRoute />);
    expect(screen.getByText('/login')).toBeTruthy();
  });

  test('redirects signed-in users to today', async () => {
    authStore.setState({ status: 'signed_in', user: { id: 'user', email: 'u@example.com', nickname: 'User', vipStatus: 'free' } });
    const screen = await render(<IndexRoute />);
    expect(screen.getByText('/today')).toBeTruthy();
  });
});
