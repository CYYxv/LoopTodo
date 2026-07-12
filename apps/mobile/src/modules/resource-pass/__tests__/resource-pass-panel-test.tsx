import { render, waitFor } from '@testing-library/react-native';

import { ResourcePassPanel } from '../components/ResourcePassPanel';

jest.mock('@/modules/tasks/database', () => ({
  getLoopTodoDatabase: async () => ({ getAllAsync: async () => [] }),
}));

describe('resource pass panel', () => {
  test('renders an empty task resource panel without an update loop', async () => {
    const screen = await render(<ResourcePassPanel taskId="task-empty" />);

    await waitFor(() => expect(screen.toJSON()).toBeTruthy());
  });
});
