import type { TaskKind, UpdateTaskInput } from './task.types';

export function taskInputError(kind: TaskKind, input: UpdateTaskInput) {
  const title = input.title.trim();
  if (!title) return '请输入任务名';
  if (title.length > 240) return '任务名不能超过 240 个字符';
  if (!Number.isInteger(input.estimateMinutes) || input.estimateMinutes < 1 || input.estimateMinutes > 180) {
    return '专注时长必须是 1–180 分钟的整数';
  }
  if (!Number.isInteger(input.restMinutes) || input.restMinutes < 0 || input.restMinutes > 180) {
    return '休息时长必须是 0–180 分钟的整数';
  }
  if (input.mustDo && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.forcedTriggerTime ?? '')) {
    return '请输入正确的今日必须触发时间';
  }
  if (kind === 'goal') {
    if (!input.deadlineAt || !Number.isFinite(input.deadlineAt)) return '请输入目标截止日期';
    if (!Number.isFinite(input.targetAmount) || (input.targetAmount ?? 0) <= 0) return '目标量必须大于 0';
    const unit = input.targetUnit?.trim() ?? '';
    if (!unit) return '请输入目标单位';
    if (unit.length > 40) return '目标单位不能超过 40 个字符';
  }
  return null;
}
