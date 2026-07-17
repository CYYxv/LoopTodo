import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Vibration } from 'react-native';

import { TaskEditForm, TaskList, TasksPanel } from '../components/TasksPanel';
import type { Task } from '../task.types';

describe('task creation form', () => {
  test('clears the title only after a successful create', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: true as const, taskId: 'created' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} />);
    const input = screen.getByPlaceholderText('例如：完成物理作业');

    await fireEvent.changeText(input, '完成作业');
    await fireEvent.press(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1));
    expect(input.props.value).toBe('');
  });

  test('keeps the title when create fails', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: false as const, error: 'write failed' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} />);
    const input = screen.getByPlaceholderText('例如：完成物理作业');

    await fireEvent.changeText(input, '保留内容');
    await fireEvent.press(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1));
    expect(input.props.value).toBe('保留内容');
    expect(screen.getByText('write failed')).toBeTruthy();
  });

  test('keeps advanced task rules out of the default path', async () => {
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} />);
    expect(screen.queryByText('休息分钟')).toBeNull();
    await fireEvent.press(screen.getByText('更多设置'));
    expect(screen.getByText('休息分钟')).toBeTruthy();
    expect(screen.getByText('设为今日必须')).toBeTruthy();
  });
});

const task = {
    id: 'forced', title: '提交报告', category: '未分类', kind: 'pomodoro', timerMode: 'countdown',
    estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
    completedAmount: 0, progressLabel: '倒计时 25 分钟', mustDo: true, forcedTriggerTime: '20:00',
    trustLevel: 'medium', status: 'pending', version: 1, syncStatus: 'pending', remoteActive: false,
  } satisfies Task;

test('keeps task cards compact and opens actions by long press or overflow', async () => {
  const onOpenActions = jest.fn();
  const vibration = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
  const screen = await render(<TaskList tasks={[task]} onStart={jest.fn()} onOpenActions={onOpenActions} />);

  expect(screen.getByText('今日必须 20:00')).toBeTruthy();
  expect(screen.queryByText('普通可信')).toBeNull();
  expect(screen.queryByText('专注设置')).toBeNull();
  expect(screen.queryByLabelText('任务：提交报告')).toBeNull();
  await fireEvent(screen.getByText('提交报告'), 'longPress');
  await fireEvent.press(screen.getByLabelText('提交报告更多操作'));
  expect(onOpenActions).toHaveBeenCalledTimes(2);
  expect(onOpenActions).toHaveBeenLastCalledWith('forced');
  expect(vibration).toHaveBeenCalledWith(20);
  vibration.mockRestore();
});

test('keeps edited task input visible when saving fails', async () => {
  const onUpdate = jest.fn(async () => ({ ok: false as const, error: '保存失败' }));
  const onUpdated = jest.fn();
  const screen = await render(<TaskEditForm task={task} onUpdate={onUpdate} onUpdated={onUpdated} />);
  const input = screen.getByDisplayValue('提交报告');

  await fireEvent.changeText(input, '修改后的报告');
  await fireEvent.press(screen.getByText('保存修改'));

  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  expect(input.props.value).toBe('修改后的报告');
  expect(screen.getByText('保存失败')).toBeTruthy();
  expect(onUpdated).not.toHaveBeenCalled();
});

test('keeps goal task editing on its supported countdown mode', async () => {
  const goal = { ...task, kind: 'goal' as const, targetAmount: 10, targetUnit: '页', deadlineAt: Date.now() };
  const screen = await render(<TaskEditForm task={goal} onUpdate={jest.fn()} />);

  expect(screen.queryByText('正计时')).toBeNull();
  expect(screen.getByText('计时方式：倒计时')).toBeTruthy();
});
