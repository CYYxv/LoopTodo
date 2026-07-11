import { render, waitFor } from '@testing-library/react-native';

import HomeRoute from '../../../app/index';
import { AppProviders } from '@/providers/AppProviders';

describe('home route', () => {
  test('renders the LoopTodo prototype through the route screen', async () => {
    const screen = await render(
      <AppProviders>
        <HomeRoute />
      </AppProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('LoopTodo')).toBeTruthy();
      expect(screen.getByText('数学套卷错题复盘')).toBeTruthy();
      expect(screen.getAllByText('锁机开发中')).toHaveLength(3);
    });
  });
});
