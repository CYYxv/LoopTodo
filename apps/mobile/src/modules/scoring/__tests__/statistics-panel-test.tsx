import { render } from '@testing-library/react-native';

import { StatisticsPanel } from '../components/StatisticsPanel';
import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';
import type { Task } from '@/modules/tasks/task.types';

test('shows the failure review directly in the failure list', async () => {
  const now = Date.now();
  const task = { id: 'task-1', title: '阅读', trustLevel: 'medium' } as Task;
  const record: FocusSessionRecord = {
    id: 'session-1', taskId: task.id, mode: 'focus', timerMode: 'countdown', phase: 'focus',
    startedAt: now - 60_000, plannedEndAt: now, restEndsAt: null, endedAt: now,
    outcome: 'exited', failureReason: '被电话打断', durationSeconds: 60, completedAmount: null,
  };

  const screen = await render(<StatisticsPanel records={[record]} tasks={[task]} />);

  expect(screen.getByText('复盘：被电话打断')).toBeTruthy();
  expect(screen.queryByText(/可信/)).toBeNull();
  expect(screen.getByText('专注方式分布')).toBeTruthy();
});
