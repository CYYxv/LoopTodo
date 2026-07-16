import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TaskList, TasksPanel } from '../components/TasksPanel';
import type { Task } from '../task.types';

describe('task creation form', () => {
  test('clears the title only after a successful create', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: true as const, taskId: 'created' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} onGoalProgress={jest.fn()} />);
    const input = screen.getByPlaceholderText('例如：完成物理作业');

    await fireEvent.changeText(input, '完成作业');
    await fireEvent.press(screen.getAllByText('创建任务')[1]);

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1));
    expect(input.props.value).toBe('');
  });

  test('keeps the title when create fails', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: false as const, error: 'write failed' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} onGoalProgress={jest.fn()} />);
    const input = screen.getByPlaceholderText('例如：完成物理作业');

    await fireEvent.changeText(input, '保留内容');
    await fireEvent.press(screen.getAllByText('创建任务')[1]);

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1));
    expect(input.props.value).toBe('保留内容');
    expect(screen.getByText('write failed')).toBeTruthy();
  });

  test('keeps advanced task rules out of the default path', async () => {
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} onGoalProgress={jest.fn()} />);
    expect(screen.queryByText('休息分钟')).toBeNull();
    await fireEvent.press(screen.getByText('更多设置'));
    expect(screen.getByText('休息分钟')).toBeTruthy();
    expect(screen.getByText('设为今日必须')).toBeTruthy();
  });
});

test('marks forced tasks inline and opens focus settings from the task card', async () => {
  const onConfigureFocus = jest.fn();
  const task = {
    id: 'forced', title: '提交报告', category: '未分类', kind: 'pomodoro', timerMode: 'countdown',
    estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
    completedAmount: 0, progressLabel: '倒计时 25 分钟', mustDo: true, forcedTriggerTime: '20:00',
    trustLevel: 'medium', status: 'pending', version: 1, syncStatus: 'pending', remoteActive: false,
  } satisfies Task;
  const screen = await render(<TaskList tasks={[task]} onStart={jest.fn()} onConfigureFocus={onConfigureFocus} onGoalProgress={jest.fn()} />);

  expect(screen.getByText('今日必须 20:00')).toBeTruthy();
  await fireEvent.press(screen.getByText('专注设置'));
  expect(onConfigureFocus).toHaveBeenCalledWith('forced');
});
