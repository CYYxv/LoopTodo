import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HabitEditForm, HabitList } from '../components/HabitsPanel';
import type { Habit } from '../habit.types';

const habit: Habit = {
  id: 'habit-1',
  name: '晨读',
  targetMinutes: 20,
  todayMinutes: 0,
  forceEnabled: false,
  triggerTime: null,
  status: 'active',
};

test('keeps the edit form open and shows the save error', async () => {
  const onSave = jest.fn(async () => ({ ok: false as const, error: '保存失败' }));
  const onSaved = jest.fn();
  const screen = await render(<HabitEditForm habit={habit} onSave={onSave} onSaved={onSaved} />);

  await fireEvent.press(screen.getByText('保存修改'));

  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(screen.getByText('保存失败')).toBeTruthy();
  expect(onSaved).not.toHaveBeenCalled();
});

test('uses HeroUI surface and press feedback without changing habit actions', async () => {
  const onProgress = jest.fn(async () => undefined);
  const onOpen = jest.fn();
  const screen = await render(<HabitList habits={[habit]} onProgress={onProgress} onArchive={jest.fn()} onOpen={onOpen} />);

  expect(screen.getByTestId('habit-surface-habit-1')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('habit-feedback-habit-1'));
  expect(onOpen).toHaveBeenCalledWith('habit-1');
  await fireEvent.press(screen.getByText('+5 分钟'));
  expect(onProgress).toHaveBeenCalledWith('habit-1', 5);
});
