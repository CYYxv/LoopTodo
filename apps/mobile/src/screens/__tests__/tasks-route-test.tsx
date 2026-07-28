import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import TasksRoute from '../../../app/(tabs)/tasks';
import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import { lockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { taskStore } from '@/modules/tasks/task.store';
import type { Task } from '@/modules/tasks/task.types';
import type { TaskCategory } from '@/modules/tasks/task.types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.setTimeout(15_000);

const task: Task = {
  id: 'task-1', title: '完成报告', category: '未分类', kind: 'pomodoro', timerMode: 'countdown',
  estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
  completedAmount: 0, progressLabel: '倒计时 25 分钟', mustDo: false, forcedTriggerTime: null,
  trustLevel: 'medium', status: 'pending', version: 1, syncStatus: 'pending', remoteActive: false,
  restrictionMode: 'none', whitelistMode: 'list', whitelistListId: null, whitelistPackages: [],
};

test('closes task actions after the selected task starts', async () => {
  const original = taskStore.getState();
  const startSession = jest.fn(async (taskId: string) => {
    const activeSession: ActiveSession = { id: 'session-1', taskId, mode: 'focus', timerMode: 'countdown', phase: 'focus', startedAt: 1, plannedEndAt: 2, restEndsAt: null };
    taskStore.setState({ activeSession });
    return { ok: true as const };
  });
  taskStore.setState({ tasks: [task], activeSession: null, sessionRecords: [], selectedTaskId: task.id, selectedMode: 'focus', error: null, startSession });

  const screen = await render(<TasksRoute />);
  await fireEvent(screen.getByText('完成报告'), 'longPress');
  expect(screen.getByText('完成专注')).toBeTruthy();
  expect(screen.getByText('累计专注')).toBeTruthy();
  await fireEvent.press(screen.getByText('开始专注'));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/session'));
  await waitFor(() => expect(screen.queryByText('累计专注')).toBeNull());
  screen.unmount();
  taskStore.setState(original, true);
});

test('opens permission recovery and jumps to each missing system setting', async () => {
  const originalTaskState = taskStore.getState();
  const originalLockState = lockEngineStore.getState();
  const open = jest.fn(async () => undefined);
  const startSession = jest.fn(async () => ({
    ok: false as const,
    error: '需要恢复软件限制权限后才能开始专注',
    missingCapabilities: ['usageAccess', 'overlay', 'vendorBackground'] as const,
  }));
  taskStore.setState({ tasks: [{ ...task, restrictionMode: 'whitelist' }], activeSession: null, error: null, startSession });
  lockEngineStore.setState({ open });

  const screen = await render(<TasksRoute />);
  await fireEvent(screen.getByText('完成报告'), 'longPress');
  await fireEvent.press(screen.getByText('开始专注'));

  expect(screen.getByText('恢复软件限制权限')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '允许查看应用使用情况' }));
  await fireEvent.press(screen.getByRole('button', { name: '允许显示在其他应用上层' }));
  await fireEvent.press(screen.getByRole('button', { name: '打开厂商后台设置' }));
  expect(open).toHaveBeenNthCalledWith(1, 'usageAccess');
  expect(open).toHaveBeenNthCalledWith(2, 'overlay');
  expect(open).toHaveBeenNthCalledWith(3, 'vendorBackground');

  screen.unmount();
  taskStore.setState(originalTaskState, true);
  lockEngineStore.setState(originalLockState, true);
});

test('refreshes restriction permissions after returning from system settings', async () => {
  const originalTaskState = taskStore.getState();
  const originalLockState = lockEngineStore.getState();
  let appStateListener: ((state: string) => void) | undefined;
  const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
  const refresh = jest.fn(async () => {
    lockEngineStore.setState({
      capabilities: {
        usageAccess: { supported: true, effective: true, reason: null },
        overlay: { supported: true, effective: true, reason: null },
        backgroundLaunch: { supported: true, effective: true, reason: null },
      } as never,
    });
  });
  const startSession = jest.fn(async () => ({
    ok: false as const,
    error: '需要恢复软件限制权限后才能开始专注',
    missingCapabilities: ['usageAccess', 'overlay', 'vendorBackground'] as const,
  }));
  taskStore.setState({ tasks: [{ ...task, restrictionMode: 'whitelist' }], activeSession: null, error: null, startSession });
  lockEngineStore.setState({ refresh, capabilities: null });

  const screen = await render(<TasksRoute />);
  await fireEvent(screen.getByText('完成报告'), 'longPress');
  await fireEvent.press(screen.getByText('开始专注'));
  expect(screen.getByText('恢复软件限制权限')).toBeTruthy();

  await act(async () => { appStateListener?.('active'); });

  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText('恢复软件限制权限')).toBeNull());
  expect(screen.getByText('权限已恢复，可以重新开始专注')).toBeTruthy();

  screen.unmount();
  appStateSpy.mockRestore();
  taskStore.setState(originalTaskState, true);
  lockEngineStore.setState(originalLockState, true);
});

test('opens task editing from the compact action panel', async () => {
  const original = taskStore.getState();
  const updateTask = jest.fn(async () => ({ ok: true as const }));
  taskStore.setState({ tasks: [task], activeSession: null, sessionRecords: [], selectedTaskId: task.id, error: null, updateTask });

  const screen = await render(<TasksRoute />);
  await fireEvent(screen.getByText('完成报告'), 'longPress');
  await fireEvent.press(screen.getByText('编辑任务'));
  const input = screen.getByDisplayValue('完成报告');
  await fireEvent.changeText(input, '修改报告');
  await fireEvent.press(screen.getByText('保存修改'));

  await waitFor(() => expect(updateTask).toHaveBeenCalledWith('task-1', 1, expect.objectContaining({ title: '修改报告' })));
  expect(screen.getByText('任务已更新')).toBeTruthy();
  screen.unmount();
  taskStore.setState(original, true);
});

const categories: TaskCategory[] = [
  { id: 'work', name: '工作', color: null, version: 1, syncStatus: 'synced' },
  { id: 'life', name: '生活', color: null, version: 1, syncStatus: 'synced' },
  { id: 'empty', name: '空分类', color: null, version: 1, syncStatus: 'synced' },
];

function categorizedTask(id: string, title: string, categoryId: string | null, category: string, status: Task['status'] = 'pending'): Task {
  return { ...task, id, title, categoryId, category, status };
}

test('renders non-empty category groups in category order with uncategorized last and no filter pills', async () => {
  const original = taskStore.getState();
  taskStore.setState({
    tasks: [
      categorizedTask('uncategorized', '整理桌面', null, '未分类'),
      categorizedTask('orphaned', '找回旧任务', 'deleted-category', '已删除分类'),
      categorizedTask('life-task', '购买牛奶', 'life', '生活'),
      categorizedTask('work-task', '整理周报', 'work', '工作'),
    ],
    categories,
    activeSession: null,
    sessionRecords: [],
    error: null,
  });

  const screen = await render(<TasksRoute />);
  const groupNames = screen.getAllByTestId('task-group').map((group) => group.props.accessibilityLabel);

  expect(groupNames).toEqual(['工作', '生活', '未分类']);
  expect(screen.getByText('找回旧任务')).toBeTruthy();
  expect(screen.queryByText('空分类')).toBeNull();
  expect(screen.queryByText('全部')).toBeNull();
  screen.unmount();
  taskStore.setState(original, true);
});

test('collapses category groups independently', async () => {
  const original = taskStore.getState();
  taskStore.setState({
    tasks: [
      categorizedTask('work-task', '整理周报', 'work', '工作'),
      categorizedTask('life-task', '购买牛奶', 'life', '生活'),
    ],
    categories,
    activeSession: null,
    sessionRecords: [],
    error: null,
  });

  const screen = await render(<TasksRoute />);
  await fireEvent.press(screen.getByRole('button', { name: '折叠工作任务组' }));

  expect(screen.queryByText('整理周报')).toBeNull();
  expect(screen.getByText('购买牛奶')).toBeTruthy();
  screen.unmount();
  taskStore.setState(original, true);
});

test('keeps completed tasks collapsed by default and expands them independently', async () => {
  const original = taskStore.getState();
  taskStore.setState({
    tasks: [
      categorizedTask('work-task', '整理周报', 'work', '工作'),
      categorizedTask('done-task', '归档发票', 'life', '生活', 'completed'),
    ],
    categories,
    activeSession: null,
    sessionRecords: [],
    error: null,
  });

  const screen = await render(<TasksRoute />);

  expect(screen.queryByText('归档发票')).toBeNull();
  expect(screen.getByText('整理周报')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '展开已完成任务组' }));
  expect(screen.getByText('归档发票')).toBeTruthy();
  expect(screen.getByText('整理周报')).toBeTruthy();
  screen.unmount();
  taskStore.setState(original, true);
});
