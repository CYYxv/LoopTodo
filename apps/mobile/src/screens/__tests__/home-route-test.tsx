import { render, waitFor } from '@testing-library/react-native';

import HomeRoute from '../../../app/index';
import { AppProviders } from '@/providers/AppProviders';

jest.mock('@/modules/tasks/database', () => ({
  getLoopTodoDatabase: async () => ({
    getAllAsync: async () => [],
    getFirstAsync: async () => null,
  }),
}));

describe('home route', () => {
  test('renders the persistent local task entry through the route screen', async () => {
    const screen = await render(
      <AppProviders>
        <HomeRoute />
      </AppProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('LoopTodo')).toBeTruthy();
      expect(screen.getByText('创建任务')).toBeTruthy();
      expect(screen.getByText('还没有任务')).toBeTruthy();
    });
  });
});
