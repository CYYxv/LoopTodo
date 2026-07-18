import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

jest.mock('heroui-native/tabs', () => require('../../../../test/statistics-heroui.mock').tabsModule);
jest.mock('heroui-native/surface', () => require('../../../../test/statistics-heroui.mock').surfaceModule);
jest.mock('heroui-native/skeleton', () => require('../../../../test/statistics-heroui.mock').skeletonModule);

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
  expect(screen.getByRole('tab', { name: '日' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: '周' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: '月' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: '年' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: '自定义' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '上一个时间范围' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '下一个时间范围' })).toBeTruthy();
  expect(screen.getByText('专注趋势')).toBeTruthy();
  expect(screen.getByText('每周时间线')).toBeTruthy();
  expect(screen.getByText('最佳开始时段')).toBeTruthy();
  expect(screen.getByText('年度专注热力图')).toBeTruthy();
  expect(screen.getByText('任务分布')).toBeTruthy();
  expect(screen.getByText('分类分布')).toBeTruthy();
  expect(screen.getByText('模式分布')).toBeTruthy();
  expect(screen.getByText('屏幕使用统计')).toBeTruthy();
  expect(screen.getByText(/未授权或当前平台不可用/)).toBeTruthy();
});

test('opens custom dates in a bottom sheet', async () => {
  const screen = await render(<StatisticsPanel records={[]} tasks={[]} />);

  await fireEvent.press(screen.getByRole('tab', { name: '自定义' }));

  expect(screen.getByLabelText('开始日期')).toBeTruthy();
  expect(screen.getByLabelText('结束日期')).toBeTruthy();
  expect(screen.getByText('应用自定义范围')).toBeTruthy();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders empty data in dark mode on a narrow screen', async () => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 320, height: 640, scale: 2, fontScale: 1 });

  const screen = await render(<StatisticsPanel records={[]} tasks={[]} />);

  expect(screen.getByText('还没有专注记录')).toBeTruthy();
  expect(screen.getAllByText('暂无数据').length).toBeGreaterThan(0);
});

test('shows Android app usage and focus interruptions', async () => {
  const usage = {
    status: 'authorized' as const,
    totalSeconds: 120,
    apps: [{ packageName: 'reader', label: '阅读器', durationSeconds: 120 }],
    interruptionCount: 1,
    interruptionApps: [{ packageName: 'reader', label: '阅读器', count: 1 }],
  };

  const screen = await render(<StatisticsPanel records={[]} tasks={[]} usage={usage} />);

  expect((await screen.findAllByText('阅读器')).length).toBe(2);
  expect(screen.getByText('专注中断 1 次')).toBeTruthy();
});

test('uses HeroUI tabs, surfaces, and skeletons for the statistics dashboard', async () => {
  const screen = await render(<StatisticsPanel records={[]} tasks={[]} />);

  expect(screen.getByLabelText('统计范围选择')).toBeTruthy();
  expect(screen.getByRole('tab', { name: '日', selected: true })).toBeTruthy();
  expect(screen.getAllByLabelText('统计指标').length).toBeGreaterThan(1);
  expect(screen.getByLabelText('积分加载占位').props.accessibilityState).toEqual({ busy: false });
});
