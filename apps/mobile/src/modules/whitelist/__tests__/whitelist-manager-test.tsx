import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { WhitelistManager } from '../components/WhitelistManager';
import { whitelistStore } from '../whitelist.store';
import { lockEngine } from '@/modules/lock-engine/lock-engine.store';
import { taskStore } from '@/modules/tasks/task.store';

jest.mock('@/modules/lock-engine/lock-engine.store', () => ({
  lockEngine: { listLaunchableApps: jest.fn(async () => []) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  taskStore.setState({ hydrate: jest.fn(async () => undefined) });
  jest.mocked(lockEngine.listLaunchableApps).mockResolvedValue([]);
  whitelistStore.setState({ loadError: null });
});

test('manages default and deletion replacement for multiple lists', async () => {
  const setDefault = jest.fn(async () => undefined);
  const archive = jest.fn(async () => true);
  const getReferenceCount = jest.fn(async () => 2);
  whitelistStore.setState({
    lists: [
      { id: 'default', name: '默认名单', packages: [], isDefault: true, version: 1, syncStatus: 'synced' },
      { id: 'study', name: '学习名单', packages: [], isDefault: false, version: 1, syncStatus: 'synced' },
    ],
    hydrated: true,
    loading: false,
    error: null,
    setDefault,
    archive,
    getReferenceCount,
  });

  const screen = await render(<WhitelistManager />);
  expect(screen.getByText('新建场景白名单')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('设学习名单为默认'));
  await fireEvent.press(screen.getByLabelText('删除学习名单'));

  expect(archive).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText('2 个任务正在使用“学习名单”')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '改用默认场景白名单并删除' }));

  await waitFor(() => {
    expect(setDefault).toHaveBeenCalledWith(expect.objectContaining({ id: 'study' }));
    expect(archive).toHaveBeenCalledWith(expect.objectContaining({ id: 'study' }), 'default', 2);
  });
});

test('requires another list to become default before deleting the current default', async () => {
  whitelistStore.setState({
    lists: [
      { id: 'default', name: '默认名单', packages: [], isDefault: true, version: 1, syncStatus: 'synced' },
      { id: 'work', name: '工作', packages: [], isDefault: false, version: 1, syncStatus: 'synced' },
    ],
    hydrated: true,
    loading: false,
    error: null,
  });

  const screen = await render(<WhitelistManager />);

  expect(screen.queryByLabelText('删除默认名单')).toBeNull();
  expect(screen.getByText('先将其他场景白名单设为默认后才能删除')).toBeTruthy();
});

test('shows up to four app icons for each scene list without package names', async () => {
  jest.mocked(lockEngine.listLaunchableApps).mockResolvedValue([
    { packageName: 'com.reader.secret', label: '阅读器', iconDataUrl: 'data:image/png;base64,aWNvbg==' },
  ]);
  whitelistStore.setState({
    lists: [{ id: 'default', name: '默认名单', packages: ['com.reader.secret'], isDefault: true, version: 1, syncStatus: 'synced' }],
    hydrated: true,
    loading: false,
    error: null,
  });

  const screen = await render(<WhitelistManager />);

  await waitFor(() => expect(screen.getByTestId('whitelist-list-icon-default-com.reader.secret')).toBeTruthy());
  expect(screen.queryByText('com.reader.secret')).toBeNull();
});

test('keeps the editing draft after a failed save and retries it', async () => {
  const update = jest.fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  whitelistStore.setState({
    lists: [{ id: 'study', name: '学习名单', packages: [], isDefault: false, version: 1, syncStatus: 'synced' }],
    hydrated: true, loading: false, error: null, update,
  });
  const screen = await render(<WhitelistManager />);
  await fireEvent.press(screen.getByLabelText('编辑学习名单'));
  const input = screen.getByDisplayValue('学习名单');
  await fireEvent.changeText(input, '深度学习');

  await fireEvent.press(screen.getByRole('button', { name: '保存场景白名单' }));

  expect(screen.getByDisplayValue('深度学习')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '重试保存' }));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  expect(update.mock.calls[1][0]).toEqual(expect.objectContaining({ id: 'study', name: '深度学习' }));
});

test('does not offer a read retry when saving a scene whitelist fails', async () => {
  const update = jest.fn(async () => {
    whitelistStore.setState({ error: '保存失败' });
    return false;
  });
  whitelistStore.setState({
    lists: [{ id: 'study', name: '学习名单', packages: [], isDefault: false, version: 1, syncStatus: 'synced' }],
    hydrated: true, loading: false, error: null, update,
  });
  const screen = await render(<WhitelistManager />);
  await fireEvent.press(screen.getByLabelText('编辑学习名单'));
  await fireEvent.press(screen.getByRole('button', { name: '保存场景白名单' }));

  await waitFor(() => expect(screen.getByText('保存失败')).toBeTruthy());
  expect(screen.getByRole('button', { name: '重试保存' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '重试读取场景白名单' })).toBeNull();
});

test('copies a scene whitelist into an editable new-list draft', async () => {
  const create = jest.fn(async () => true);
  whitelistStore.setState({
    lists: [{ id: 'study', name: '学习名单', packages: ['com.reader'], isDefault: false, version: 1, syncStatus: 'synced' }],
    hydrated: true, loading: false, error: null, create,
  });
  const screen = await render(<WhitelistManager />);

  await fireEvent.press(screen.getByLabelText('复制学习名单'));

  expect(screen.getByDisplayValue('学习名单 副本')).toBeTruthy();
  await fireEvent.changeText(screen.getByDisplayValue('学习名单 副本'), '考试复习');
  await fireEvent.press(screen.getByRole('button', { name: '创建场景白名单' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('考试复习', ['com.reader']));
});

test('reloads tasks from SQLite after deleting a referenced whitelist', async () => {
  const hydrateTasks = jest.fn(async () => undefined);
  const archive = jest.fn(async () => true);
  taskStore.setState({ hydrate: hydrateTasks });
  whitelistStore.setState({
    lists: [
      { id: 'default', name: '默认名单', packages: [], isDefault: true, version: 1, syncStatus: 'synced' },
      { id: 'study', name: '学习名单', packages: [], isDefault: false, version: 1, syncStatus: 'synced' },
    ],
    hydrated: true, loading: false, error: null,
    getReferenceCount: jest.fn(async () => 1), archive,
  });
  const screen = await render(<WhitelistManager />);

  await fireEvent.press(screen.getByLabelText('删除学习名单'));
  await waitFor(() => expect(screen.getByText('1 个任务正在使用“学习名单”')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '改用默认场景白名单并删除' }));

  await waitFor(() => expect(hydrateTasks).toHaveBeenCalledTimes(1));
});

test('retries reading scene whitelists after hydration fails', async () => {
  const hydrate = jest.fn(async () => undefined);
  whitelistStore.setState({
    lists: [], hydrated: true, loading: false, error: '场景白名单读取失败', loadError: '场景白名单读取失败', hydrate,
  });
  const screen = await render(<WhitelistManager />);

  expect(screen.getByText('场景白名单读取失败')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '重试读取场景白名单' }));

  expect(hydrate).toHaveBeenLastCalledWith(true);
});

test('uses scene whitelist terminology while lists are loading', async () => {
  whitelistStore.setState({ lists: [], hydrated: false, loading: true, error: null, loadError: null });
  const screen = await render(<WhitelistManager />);

  expect(screen.getByText('正在读取场景白名单…')).toBeTruthy();
  expect(screen.queryByText('正在读取名单…')).toBeNull();
});

test('retries reading installed software instead of showing an empty list', async () => {
  jest.mocked(lockEngine.listLaunchableApps)
    .mockRejectedValueOnce(new Error('native read failed'))
    .mockResolvedValueOnce([{ packageName: 'com.reader', label: '阅读器' }]);
  whitelistStore.setState({
    lists: [{ id: 'default', name: '默认名单', packages: ['com.reader'], isDefault: true, version: 1, syncStatus: 'synced' }],
    hydrated: true, loading: false, error: null,
  });
  const screen = await render(<WhitelistManager />);

  await waitFor(() => expect(screen.getByText('本机软件读取失败，请重试')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '重试读取本机软件' }));

  await waitFor(() => expect(screen.getByTestId('whitelist-list-icon-default-com.reader')).toBeTruthy());
  expect(screen.queryByText('本机软件读取失败，请重试')).toBeNull();
});
