import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }), { virtual: true });

import { ActiveSessionScreen } from '../components/ActiveSessionScreen';
import type { ActiveSession } from '../focus-session.types';
import type { Task } from '@/modules/tasks/task.types';

const session: ActiveSession = {
  id: 'session-1', taskId: 'task-1', mode: 'focus', timerMode: 'countdown', phase: 'focus',
  startedAt: Date.now(), plannedEndAt: Date.now() + 25 * 60_000, restEndsAt: null,
  pausedAt: null, accumulatedPausedMs: 0,
};
const task: Task = {
  id: 'task-1', title: '完成设计稿', category: '未分类', kind: 'pomodoro', timerMode: 'countdown',
  estimateMinutes: 25, restMinutes: 5, deadlineAt: null, targetAmount: null, targetUnit: null,
  completedAmount: 0, progressLabel: '倒计时 25 分钟', mustDo: false, forcedTriggerTime: null,
  trustLevel: 'medium', status: 'active', version: 2, syncStatus: 'pending', remoteActive: false,
};

test('renders a centered timer with icon controls and no instructional copy', async () => {
  const onTogglePause = jest.fn(async () => undefined);
  const screen = await render(<ActiveSessionScreen session={session} task={task} error={null}
    onTogglePause={onTogglePause} onComplete={jest.fn()} onExit={jest.fn()} onFinishRest={jest.fn()} />);

  expect(screen.getByTestId('focus-timer-ring')).toBeTruthy();
  expect(screen.getByText('完成设计稿')).toBeTruthy();
  expect(screen.queryByText('进行中状态已写入本机，重启后继续恢复')).toBeNull();
  expect(screen.queryByText('先完成一个小闭环，再讨论完美不完美。')).toBeNull();
  await fireEvent.press(screen.getByLabelText('暂停专注'));
  expect(onTogglePause).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('关闭屏幕常亮'));
  expect(screen.getByLabelText('开启屏幕常亮')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('结束专注'));
  expect(screen.getByText('完成专注')).toBeTruthy();
});

test('shows a play control for a paused session', async () => {
  const screen = await render(<ActiveSessionScreen session={{ ...session, pausedAt: Date.now() }} task={task} error={null}
    onTogglePause={jest.fn()} onComplete={jest.fn()} onExit={jest.fn()} onFinishRest={jest.fn()} />);
  expect(screen.getByLabelText('继续专注')).toBeTruthy();
});

test('submits a completion note when finishing focus', async () => {
  const onComplete = jest.fn(async () => undefined);
  const screen = await render(<ActiveSessionScreen session={session} task={task} error={null}
    onTogglePause={jest.fn()} onComplete={onComplete as never} onExit={jest.fn()} onFinishRest={jest.fn()} />);

  await fireEvent.press(screen.getByLabelText('结束专注'));
  await fireEvent.changeText(screen.getByLabelText('本次完成内容'), '完成第一章练习');
  await fireEvent.press(screen.getByText('完成专注'));

  expect(onComplete).toHaveBeenCalledWith(undefined, '完成第一章练习');
});
