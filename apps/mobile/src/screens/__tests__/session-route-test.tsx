import { fireEvent, render } from '@testing-library/react-native';

import SessionRoute from '../../../app/session';
import { taskStore } from '@/modules/tasks/task.store';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: mockReplace }),
}));

test('shows the whitelist settlement copy and clears its snapshot when leaving', async () => {
  const original = taskStore.getState();
  taskStore.setState({
    activeSession: null,
    lastStarDelta: 2,
    lastStarRestrictionMode: 'whitelist',
  });

  const screen = await render(<SessionRoute />);

  expect(screen.getByText('完成白名单专注，本次 +2 星')).toBeTruthy();
  await fireEvent.press(screen.getByText('返回任务'));
  expect(taskStore.getState().lastStarDelta).toBeNull();
  expect(taskStore.getState().lastStarRestrictionMode).toBeNull();
  expect(mockReplace).toHaveBeenCalledWith('/tasks');

  screen.unmount();
  taskStore.setState(original, true);
});
