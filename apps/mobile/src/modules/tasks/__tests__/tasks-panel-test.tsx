import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TasksPanel } from '../components/TasksPanel';

describe('task creation form', () => {
  test('clears the title only after a successful create', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: true as const, taskId: 'created' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} onGoalProgress={jest.fn()} />);
    const input = screen.getByPlaceholderText('例如：完成物理作业');

    await fireEvent.changeText(input, '完成作业');
    await fireEvent.press(screen.getByText('添加到今日待办'));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1));
    expect(input.props.value).toBe('');
  });

  test('keeps the title when create fails', async () => {
    const onCreateTask = jest.fn(async () => ({ ok: false as const, error: 'write failed' }));
    const screen = await render(<TasksPanel tasks={[]} onCreateTask={onCreateTask} onStart={jest.fn()} onGoalProgress={jest.fn()} />);
    const input = screen.getByPlaceholderText('例如：完成物理作业');

    await fireEvent.changeText(input, '保留内容');
    await fireEvent.press(screen.getByText('添加到今日待办'));

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1));
    expect(input.props.value).toBe('保留内容');
  });
});
