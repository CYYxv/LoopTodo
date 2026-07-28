import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet, Vibration } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { TaskActionPanel, TaskEditForm, TaskGroups, TaskList, TasksPanel } from '../components/TasksPanel';
import type { Task, TaskCategory } from '../task.types';
import { whitelistStore } from '@/modules/whitelist/whitelist.store';
import { lockEngine } from '@/modules/lock-engine/lock-engine.store';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock('@/modules/lock-engine/lock-engine.store', () => ({
  lockEngine: { listLaunchableApps: jest.fn(async () => []) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  whitelistStore.setState({
    lists: [{ id: 'study', name: '学习名单', packages: ['com.reader'], isDefault: true, version: 1, syncStatus: 'synced' }],
    hydrated: true,
    loading: false,
    error: null,
    loadError: null,
  });
  jest.mocked(lockEngine.listLaunchableApps).mockResolvedValue([]);
});

describe('task creation form', () => {
  test('offers three restriction modes and a named whitelist source', async () => {
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} />);
    await fireEvent.press(screen.getByText('更多设置'));

    expect(screen.getByText('不限制')).toBeTruthy();
    expect(screen.getByText('软件白名单')).toBeTruthy();
    expect(screen.getByText('严格模式')).toBeTruthy();
    expect(screen.getByText('使用场景白名单')).toBeTruthy();
    expect(screen.getByText('为此任务单独设置')).toBeTruthy();
  });

  test('submits the selected restriction mode without whitelist payload', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: true as const, taskId: 'created' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText('例如：完成物理作业'), '自由任务');
    await fireEvent.press(screen.getByText('更多设置'));
    await fireEvent.press(screen.getByText('不限制'));
    await fireEvent.press(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      restrictionMode: 'none',
      whitelistMode: 'list',
      whitelistListId: null,
      whitelistPackages: [],
    })));
  });

  test('copies the selected scene list when first switching to a task-only whitelist', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: true as const, taskId: 'created' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('例如：完成物理作业'), '阅读任务');
    await fireEvent.press(screen.getByText('更多设置'));
    await fireEvent.press(screen.getByText('为此任务单独设置'));
    await fireEvent.press(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      whitelistMode: 'custom',
      whitelistListId: null,
      whitelistPackages: ['com.reader'],
    })));
  });

  test('shows the selected list name, app count, five icons, and a modify entry', async () => {
    const packages = ['app.1', 'app.2', 'app.3', 'app.4', 'app.5', 'app.6'];
    whitelistStore.setState({
      lists: [{ id: 'study', name: '学习名单', packages, isDefault: true, version: 1, syncStatus: 'synced' }],
      hydrated: true, loading: false, error: null,
    });
    jest.mocked(lockEngine.listLaunchableApps).mockResolvedValue(packages.map((packageName, index) => ({
      packageName, label: `应用 ${index + 1}`, iconDataUrl: 'data:image/png;base64,aWNvbg==',
    })));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} />);
    await fireEvent.press(screen.getByText('更多设置'));

    expect(screen.getByText('学习名单')).toBeTruthy();
    expect(screen.getByText('6 个软件')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('task-whitelist-icon-app.5')).toBeTruthy());
    expect(screen.queryByTestId('task-whitelist-icon-app.6')).toBeNull();
    expect(screen.getByRole('button', { name: '修改场景白名单' })).toBeTruthy();
  });

  test('explains that an empty scene whitelist only allows LoopTodo', async () => {
    whitelistStore.setState({
      lists: [{ id: 'empty', name: '空名单', packages: [], isDefault: true, version: 1, syncStatus: 'synced' }],
      hydrated: true, loading: false, error: null,
    });
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} />);
    await fireEvent.press(screen.getByText('更多设置'));

    expect(screen.getByText('未选择其他软件，专注期间只能使用 LoopTodo')).toBeTruthy();
    expect(screen.queryByText('当前名单为空')).toBeNull();
  });

  test('shows the current restriction summary while more settings are collapsed', async () => {
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('当前限制：软件白名单 · 学习名单')).toBeTruthy());
    expect(screen.getByText('更多设置')).toBeTruthy();
  });

  test('edits the selected scene list without converting the task to a custom list', async () => {
    const update = jest.fn(async () => true);
    whitelistStore.setState({
      lists: [{ id: 'study', name: '学习名单', packages: ['com.reader'], isDefault: true, version: 1, syncStatus: 'synced' }],
      hydrated: true, loading: false, error: null, update,
    });
    jest.mocked(lockEngine.listLaunchableApps).mockResolvedValue([
      { packageName: 'com.reader', label: '阅读器' },
      { packageName: 'com.notes', label: '笔记' },
    ]);
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} />);
    await fireEvent.press(screen.getByText('更多设置'));
    await fireEvent.press(screen.getByRole('button', { name: '修改场景白名单' }));

    expect(screen.getByText('编辑“学习名单”')).toBeTruthy();
    expect(screen.getByText('修改后，使用此场景白名单且尚未开始的任务会同步更新。')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: '笔记' }));
    await fireEvent.press(screen.getByRole('button', { name: '保存已选软件' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      id: 'study', packages: ['com.reader', 'com.notes'],
    })));
  });

  test('stops whitelist task submission when list hydration failed', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: true as const, taskId: 'created' }));
    const hydrate = jest.fn(async () => {
      whitelistStore.setState({ hydrated: true, loading: false, error: '名单读取失败', loadError: '名单读取失败' });
    });
    whitelistStore.setState({ lists: [], hydrated: false, loading: false, error: null, loadError: null, hydrate });
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} />);
    await waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1));
    await fireEvent.changeText(screen.getByPlaceholderText('例如：完成物理作业'), '阅读任务');
    await fireEvent.press(screen.getByRole('button', { name: '创建任务' }));

    expect(onCreateTask).not.toHaveBeenCalled();
    expect(screen.getByText('名单读取失败')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '重试读取场景白名单' }));
    expect(hydrate).toHaveBeenLastCalledWith(true);
  });

  test('shows an explicit retry when installed software cannot be read', async () => {
    jest.mocked(lockEngine.listLaunchableApps)
      .mockRejectedValueOnce(new Error('native read failed'))
      .mockResolvedValueOnce([{ packageName: 'com.reader', label: '阅读器' }]);
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={jest.fn()} onStart={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('本机软件读取失败，请重试')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: '重试读取本机软件' }));

    await waitFor(() => expect(lockEngine.listLaunchableApps).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByText('更多设置'));
    expect(screen.queryByText('本机软件读取失败，请重试')).toBeNull();
  });

  test('does not read lists or enumerate apps for a non-whitelist task', async () => {
    const hydrate = jest.fn(async () => undefined);
    whitelistStore.setState({ lists: [], hydrated: false, loading: false, error: null, hydrate });
    const screen = await render(<TaskEditForm task={{ ...task, restrictionMode: 'none' }} onUpdate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('专注限制')).toBeTruthy());
    expect(hydrate).not.toHaveBeenCalled();
    expect(lockEngine.listLaunchableApps).not.toHaveBeenCalled();
  });
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
    restrictionMode: 'whitelist', whitelistMode: 'inherit', whitelistListId: null, whitelistPackages: [],
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

test('starts focus directly from task actions without a second settings step', async () => {
  const onStart = jest.fn();
  const screen = await render(<TaskActionPanel task={task} records={[]} activeSession={null} onEdit={jest.fn()}
    onStart={onStart} onGoalProgress={jest.fn(async () => undefined)} onDelete={jest.fn(async () => undefined)} />);

  expect(screen.queryByText('专注设置')).toBeNull();
  await fireEvent.press(screen.getByText('开始专注'));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('keeps the compact task row and its actions at least 44dp tall', async () => {
  const screen = await render(<TaskList tasks={[task]} onStart={jest.fn()} onOpenActions={jest.fn()} />);

  const rowStyle = StyleSheet.flatten(screen.getByTestId('task-row-forced').props.style);
  const moreStyle = StyleSheet.flatten(screen.getByLabelText('提交报告更多操作').props.style);

  expect(rowStyle.minHeight).toBeGreaterThanOrEqual(44);
  expect(moreStyle.height).toBeGreaterThanOrEqual(44);
});

test('does not force a white task group background in dark mode', async () => {
  const categories: TaskCategory[] = [{ id: 'work', name: '工作', color: null, version: 1, syncStatus: 'synced' }];
  const screen = await render(<TaskGroups tasks={[{ ...task, categoryId: 'work', category: '工作' }]} categories={categories} onStart={jest.fn()} />);

  expect(screen.getByTestId('task-group-surface-work').props.className).not.toContain('bg-white');
});

test('uses HeroUI surfaces, accordion groups, and press feedback for the task hierarchy', async () => {
  const categories: TaskCategory[] = [{ id: 'work', name: '工作', color: null, version: 1, syncStatus: 'synced' }];
  const screen = await render(<TaskGroups tasks={[{ ...task, categoryId: 'work', category: '工作' }]} categories={categories} onStart={jest.fn()} />);

  expect(screen.getByTestId('hero-accordion')).toBeTruthy();
  expect(screen.getByTestId('task-group-surface-work')).toBeTruthy();
  expect(screen.getByTestId('task-row-feedback-forced')).toBeTruthy();
});

test('restores collapsed task groups from local preferences', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(['work']));
  const categories: TaskCategory[] = [{ id: 'work', name: '工作', color: null, version: 1, syncStatus: 'synced' }];
  const screen = await render(<TaskGroups tasks={[{ ...task, categoryId: 'work', category: '工作' }]} categories={categories} onStart={jest.fn()} />);

  await waitFor(() => expect(screen.queryByText(task.title)).toBeNull());
});

test('does not overwrite a user collapse while saved preferences are still loading', async () => {
  let resolveSaved: (value: string | null) => void = () => undefined;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(() => new Promise((resolve) => { resolveSaved = resolve; }));
  const categories: TaskCategory[] = [
    { id: 'work', name: '工作', color: null, version: 1, syncStatus: 'synced' },
    { id: 'life', name: '生活', color: null, version: 1, syncStatus: 'synced' },
  ];
  const screen = await render(<TaskGroups tasks={[
    { ...task, id: 'work-task', title: '工作任务', categoryId: 'work', category: '工作' },
    { ...task, id: 'life-task', title: '生活任务', categoryId: 'life', category: '生活' },
  ]} categories={categories} onStart={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: '折叠工作任务组' }));
  await act(async () => { resolveSaved(JSON.stringify(['life'])); });

  await waitFor(() => {
    expect(screen.queryByText('工作任务')).toBeNull();
    expect(screen.queryByText('生活任务')).toBeNull();
  });
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
