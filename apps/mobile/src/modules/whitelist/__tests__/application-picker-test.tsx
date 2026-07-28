import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApplicationPicker } from '../components/ApplicationPicker';
import { clearAnalyticsEvents, getAnalyticsEvents } from '@/modules/analytics/analytics';

beforeEach(() => clearAnalyticsEvents());

test('searches launchable apps and toggles labels without exposing package names', async () => {
  const onChange = jest.fn();
  const screen = await render(<ApplicationPicker apps={[
    { packageName: 'com.reader.secret', label: '阅读器' },
    { packageName: 'com.music.secret', label: '音乐' },
  ]} selected={[]} onChange={onChange} />);

  expect(screen.queryByText('com.reader.secret')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '选择软件，已选 0 个' }));
  await fireEvent.changeText(screen.getByPlaceholderText('搜索本机软件'), '阅读');
  expect(screen.queryByText('音乐')).toBeNull();
  await fireEvent.press(screen.getByRole('checkbox', { name: '阅读器' }));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '保存已选软件' }));
  expect(onChange).toHaveBeenCalledWith(['com.reader.secret']);
});

test('tracks picker open and save without software identity fields', async () => {
  const screen = await render(<ApplicationPicker title="任务名单" source="task" listId="study" apps={[
    { packageName: 'com.reader.secret', label: '阅读器', iconDataUrl: null },
  ]} selected={[]} onChange={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: '选择软件，已选 0 个' }));
  await fireEvent.press(screen.getByText('阅读器'));
  await fireEvent.press(screen.getByRole('button', { name: '保存已选软件' }));

  expect(getAnalyticsEvents().map(({ event, props }) => ({ event, props }))).toEqual([
    { event: 'whitelist_picker_opened', props: { listId: 'study', source: 'task', selectedCount: 0 } },
    { event: 'whitelist_saved', props: { listId: 'study', source: 'task', selectedCount: 1 } },
  ]);
});

test('opens a picker sheet and commits the draft only when saved', async () => {
  const onChange = jest.fn();
  const screen = await render(<ApplicationPicker apps={[
    { packageName: 'com.reader.secret', label: '阅读器' },
    { packageName: 'com.notes.secret', label: '笔记' },
  ]} selected={['com.reader.secret']} onChange={onChange} title="本任务单独设置" />);

  expect(screen.queryByText('笔记')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '选择软件，已选 1 个' }));
  expect(screen.getByText('本任务单独设置')).toBeTruthy();
  expect(screen.getByText('已选 1 个')).toBeTruthy();

  await fireEvent.press(screen.getByRole('checkbox', { name: '笔记' }));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '保存已选软件' }));

  expect(onChange).toHaveBeenCalledWith(['com.reader.secret', 'com.notes.secret']);
});

test('shows native app icons in the selected summary and picker row', async () => {
  const iconDataUrl = 'data:image/png;base64,aWNvbg==';
  const screen = await render(<ApplicationPicker apps={[
    { packageName: 'com.reader.secret', label: '阅读器', iconDataUrl },
  ]} selected={['com.reader.secret']} onChange={jest.fn()} />);

  expect(screen.getByTestId('selected-app-icon-com.reader.secret').props.source).toEqual({ uri: iconDataUrl });
  await fireEvent.press(screen.getByRole('button', { name: '选择软件，已选 1 个' }));
  expect(screen.getByTestId('app-icon-com.reader.secret').props.source).toEqual({ uri: iconDataUrl });
});

test('keeps the picker open and offers retry when persistence fails', async () => {
  const onChange = jest.fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  const screen = await render(<ApplicationPicker apps={[
    { packageName: 'com.reader.secret', label: '阅读器' },
  ]} selected={[]} onChange={onChange} />);

  await fireEvent.press(screen.getByRole('button', { name: '选择软件，已选 0 个' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '阅读器' }));
  await fireEvent.press(screen.getByRole('button', { name: '保存已选软件' }));

  await waitFor(() => expect(screen.getByText('保存失败，请重试')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '重试保存已选软件' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
});
