import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import type { SessionMode } from '@/modules/focus-session/focus-session.types';
import type { CreateTaskInput, Task, TaskKind, TimerMode, TrustLevel } from '@/modules/tasks/task.types';
import type { CreateTaskResult } from '@/modules/tasks/task.store';
import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import { getTaskExecutionState, taskExecutionReason } from '@/modules/tasks/task.execution';

const trustCopy: Record<TrustLevel, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  high: { label: '高可信', color: 'success' },
  medium: { label: '普通可信', color: 'warning' },
  low: { label: '开放专注', color: 'danger' },
};

export function TasksPanel({ tasks, onCreateTask, onStart, onGoalProgress }: { tasks: Task[]; onCreateTask: (input: CreateTaskInput) => Promise<CreateTaskResult>; onStart: (taskId: string, mode: SessionMode) => void; onGoalProgress: (taskId: string, amount: number) => Promise<void> }) {
  return <View className="gap-4"><TaskCreateForm onCreate={onCreateTask} /><TaskList tasks={tasks} onStart={onStart} onGoalProgress={onGoalProgress} /></View>;
}

export function TaskCreateForm({ onCreate, onCreated }: { onCreate: (input: CreateTaskInput) => Promise<CreateTaskResult>; onCreated?: (taskId: string) => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskKind>('pomodoro');
  const [timerMode, setTimerMode] = useState<TimerMode>('countdown');
  const [minutes, setMinutes] = useState('25');
  const [restMinutes, setRestMinutes] = useState('5');
  const [deadline, setDeadline] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetUnit, setTargetUnit] = useState('页');
  const [mustDo, setMustDo] = useState(false);
  const [forcedTriggerTime, setForcedTriggerTime] = useState('20:00');
  const [showMore, setShowMore] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    const parsedDeadline = deadline ? Date.parse(`${deadline}T23:59:59`) : null;
    setSubmitError(null);
    const result = await onCreate({
      title: title.trim(), category: '收集箱', kind,
      timerMode: kind === 'goal' ? 'countdown' : timerMode,
      estimateMinutes: Number(minutes), restMinutes: Number(restMinutes),
      deadlineAt: Number.isFinite(parsedDeadline) ? parsedDeadline : null,
      targetAmount: kind === 'goal' ? Number(targetAmount) : null,
      targetUnit: kind === 'goal' ? targetUnit.trim() : null,
      mustDo, forcedTriggerTime: mustDo ? forcedTriggerTime : null, trustLevel: 'medium',
    });
    if (result.ok) {
      setTitle('');
      onCreated?.(result.taskId);
    } else {
      setSubmitError(result.error);
    }
  };

  return <Card variant="secondary"><Card.Body className="gap-3"><View><Card.Title>创建今日任务</Card.Title><Card.Description>先填写必要信息，其他规则可稍后展开。</Card.Description></View><Field label="任务名" value={title} onChange={setTitle} placeholder="例如：完成物理作业" /><ChoiceRow value={timerMode} options={[["countdown", "倒计时"], ["countup", "正计时"], ["untimed", "不计时"]]} onChange={(value) => setTimerMode(value as TimerMode)} />{timerMode === 'countdown' || kind === 'goal' ? <Field label={kind === 'goal' ? '单次专注分钟' : '专注分钟'} value={minutes} onChange={setMinutes} keyboard="numeric" /> : null}<Button variant="secondary" onPress={() => setShowMore((value) => !value)}>{showMore ? '收起更多设置' : '更多设置'}</Button>{showMore ? <View className="gap-3"><ChoiceRow value={kind} options={[["pomodoro", "普通番茄钟"], ["goal", "定目标"]]} onChange={(value) => setKind(value as TaskKind)} />{kind === 'goal' ? <><Field label="截止日期" value={deadline} onChange={setDeadline} placeholder="YYYY-MM-DD" /><View className="flex-row gap-2"><View className="flex-1"><Field label="目标量" value={targetAmount} onChange={setTargetAmount} placeholder="例如 30" keyboard="numeric" /></View><View className="flex-1"><Field label="单位" value={targetUnit} onChange={setTargetUnit} placeholder="页/个/套/小时/次" /></View></View></> : null}<Field label="休息分钟" value={restMinutes} onChange={setRestMinutes} keyboard="numeric" /><Button variant={mustDo ? 'danger-soft' : 'secondary'} onPress={() => setMustDo((value) => !value)}>{mustDo ? '今日必须并启用强制触发' : '普通今日任务'}</Button>{mustDo ? <Field label="强制触发时间" value={forcedTriggerTime} onChange={setForcedTriggerTime} placeholder="HH:mm" /> : null}</View> : null}{submitError ? <Text type="body-sm" color="danger" accessibilityRole="alert">{submitError}</Text> : null}<Button isDisabled={!title.trim()} onPress={() => void submit()}>添加到今日待办</Button>{!title.trim() ? <Text type="body-xs" color="muted">填写任务名后即可创建</Text> : null}</Card.Body></Card>;
}

export function TaskList({ tasks, activeSession = null, onStart, onGoalProgress }: { tasks: Task[]; activeSession?: ActiveSession | null; onStart: (taskId: string, mode: SessionMode) => void; onGoalProgress: (taskId: string, amount: number) => Promise<void> }) {
  return <View className="gap-3">{tasks.length === 0 ? <Card><Card.Body><Card.Title>还没有任务</Card.Title><Card.Description>创建一个最小任务，开始今天的闭环。</Card.Description></Card.Body></Card> : tasks.map((task) => <TaskCard key={task.id} task={task} activeSession={activeSession} onStart={onStart} onGoalProgress={onGoalProgress} />)}</View>;
}

function Field({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: 'numeric' }) {
  return <TextField><Label>{label}</Label><Input value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboard} /></TextField>;
}

function ChoiceRow({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">{options.map(([id, label]) => <Button key={id} size="sm" variant={value === id ? 'primary' : 'secondary'} accessibilityRole="radio" accessibilityState={{ selected: value === id }} onPress={() => onChange(id)}>{label}</Button>)}</View>;
}

function TaskCard({ task, activeSession, onStart, onGoalProgress }: { task: Task; activeSession: ActiveSession | null; onStart: (taskId: string, mode: SessionMode) => void; onGoalProgress: (taskId: string, amount: number) => Promise<void> }) {
  const [progress, setProgress] = useState('1');
  const trust = trustCopy[task.trustLevel];
  const executionState = getTaskExecutionState(task, activeSession);
  const canStart = executionState === 'available' || executionState === 'local_active';
  const reason = taskExecutionReason(executionState);
  return <Card><Card.Body className="gap-4"><View className="gap-2"><View className="flex-row flex-wrap items-center gap-2"><Chip size="sm" color={task.mustDo ? 'danger' : 'default'} variant="secondary">{task.mustDo ? `今日必须 ${task.forcedTriggerTime ?? ''}` : task.category}</Chip><Chip size="sm" color={trust.color} variant="soft">{trust.label}</Chip>{executionState === 'completed' ? <Chip size="sm" color="success" variant="soft">已完成</Chip> : null}{executionState === 'remote_active' ? <Chip size="sm" color="danger" variant="soft">其他设备专注中</Chip> : null}{executionState === 'sync_conflict' ? <Chip size="sm" color="danger" variant="soft">同步冲突</Chip> : null}{executionState === 'stale_active' ? <Chip size="sm" color="warning" variant="soft">状态待恢复</Chip> : null}</View><Card.Title>{task.title}</Card.Title><Card.Description>{task.progressLabel}</Card.Description></View>{task.kind === 'goal' && executionState === 'available' ? <View className="flex-row items-end gap-2"><View className="flex-1"><Field label={`补记完成量（${task.targetUnit}）`} value={progress} onChange={setProgress} keyboard="numeric" /></View><Button size="sm" onPress={() => void onGoalProgress(task.id, Number(progress))}>记录</Button></View> : null}<View className="flex-row items-center justify-between gap-3"><Text type="body-sm" color="muted">{task.timerMode === 'untimed' ? '不计时' : `${task.estimateMinutes} 分钟`}</Text><Button size="sm" variant="secondary" isDisabled={!canStart} accessibilityLabel={`${executionState === 'local_active' ? '继续' : '开始'}${task.title}专注`} onPress={() => onStart(task.id, 'focus')}>{executionState === 'local_active' ? '继续' : '专注'}</Button></View>{reason && executionState !== 'completed' ? <Text type="body-xs" color="muted">{reason}</Text> : null}</Card.Body></Card>;
}
