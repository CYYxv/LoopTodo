import type { CreateTaskInput, Task } from './task.types';

type ProgressTask = Pick<
  Task,
  'kind' | 'timerMode' | 'estimateMinutes' | 'restMinutes' | 'targetAmount' | 'targetUnit' | 'completedAmount'
>;

export function taskProgressLabel(task: ProgressTask) {
  if (task.kind === 'goal') {
    return `目标 ${task.completedAmount}/${task.targetAmount ?? 0} ${task.targetUnit ?? ''} · 单次 ${task.estimateMinutes} 分钟`;
  }

  const modeLabel = {
    countdown: `倒计时 ${task.estimateMinutes} 分钟`,
    countup: '正向计时',
    untimed: '不计时',
  }[task.timerMode];
  return `${modeLabel} · 休息 ${task.restMinutes} 分钟`;
}

export function taskFromInput(id: string, input: CreateTaskInput): Task {
  const task: Task = {
    ...input,
    id,
    status: 'pending',
    completedAmount: 0,
    progressLabel: '',
  };
  return { ...task, progressLabel: taskProgressLabel(task) };
}
