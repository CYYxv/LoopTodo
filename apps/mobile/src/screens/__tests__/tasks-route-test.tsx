import { fireEvent, render, waitFor } from '@testing-library/react-native';

import TasksRoute from '../../../app/(tabs)/tasks';
import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import { taskStore } from '@/modules/tasks/task.store';
import type { Task } from '@/modules/tasks/task.types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const task: Task = {
  id: 'task-1', title: '完成报告', category: '未分类', kind: 'pomodoro', timerMode: 'countdown',
  estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
  completedAmount: 0, progressLabel: '倒计时 25 分钟', mustDo: false, forcedTriggerTime: null,
  trustLevel: 'medium', status: 'pending', version: 1, syncStatus: 'pending', remoteActive: false,
};

test('closes focus settings after the selected task starts', async () => {
  const original = taskStore.getState();
  const startSession = jest.fn(async (taskId: string) => {
    const activeSession: ActiveSession = { id: 'session-1', taskId, mode: 'focus', timerMode: 'countdown', phase: 'focus', startedAt: 1, plannedEndAt: 2, restEndsAt: null };
    taskStore.setState({ activeSession });
  });
  taskStore.setState({ tasks: [task], activeSession: null, sessionRecords: [], selectedTaskId: task.id, selectedMode: 'focus', error: null, startSession });

  const screen = await render(<TasksRoute />);
  await fireEvent.press(screen.getByText('专注设置'));
  await fireEvent.press(screen.getByText('开始可信专注'));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/session'));
  expect(screen.queryByText('选择执行强度')).toBeNull();
  screen.unmount();
  taskStore.setState(original, true);
});
