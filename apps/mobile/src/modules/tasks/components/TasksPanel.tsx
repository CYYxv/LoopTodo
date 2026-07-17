import { useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, Vibration, View } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import type { ActiveSession, FocusSessionRecord, SessionMode } from '@/modules/focus-session/focus-session.types';
import { Button, Card, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import type { CreateTaskResult, UpdateTaskResult } from '../task.store';
import { getTaskExecutionState, taskExecutionReason } from '../task.execution';
import { taskSessionStatistics } from '../task-session.statistics';
import type { CreateTaskInput, Task, TaskKind, TimerMode, UpdateTaskInput } from '../task.types';

export function TasksPanel({ tasks, onCreateTask, onStart }: { tasks: Task[]; onCreateTask(input: CreateTaskInput): Promise<CreateTaskResult>; onStart(taskId: string, mode: SessionMode): void }) {
  return <View className="gap-4"><TaskCreateForm onCreate={onCreateTask} /><TaskList tasks={tasks} onStart={onStart} /></View>;
}

export function TaskCreateForm({ onCreate, onCreated }: { onCreate(input: CreateTaskInput): Promise<CreateTaskResult>; onCreated?(taskId: string): void }) {
  return <TaskForm submitLabel="创建任务" onSubmit={onCreate} onSuccess={(result) => {
    if ('taskId' in result) onCreated?.(result.taskId);
  }} />;
}

export function TaskEditForm({ task, onUpdate, onUpdated }: { task: Task; onUpdate(input: UpdateTaskInput): Promise<UpdateTaskResult>; onUpdated?(): void }) {
  return <TaskForm initialTask={task} submitLabel="保存修改" onSubmit={(input) => {
    const { title, timerMode, estimateMinutes, restMinutes, deadlineAt, targetAmount, targetUnit, mustDo, forcedTriggerTime } = input;
    return onUpdate({ title, timerMode, estimateMinutes, restMinutes, deadlineAt, targetAmount, targetUnit, mustDo, forcedTriggerTime });
  }} onSuccess={() => onUpdated?.()} />;
}

function TaskForm({ initialTask, submitLabel, onSubmit, onSuccess }: {
  initialTask?: Task;
  submitLabel: string;
  onSubmit(input: CreateTaskInput): Promise<CreateTaskResult | UpdateTaskResult>;
  onSuccess(result: Extract<CreateTaskResult | UpdateTaskResult, { ok: true }>): void;
}) {
  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [kind, setKind] = useState<TaskKind>(initialTask?.kind ?? 'pomodoro');
  const [timerMode, setTimerMode] = useState<TimerMode>(initialTask?.timerMode ?? 'countdown');
  const [minutes, setMinutes] = useState(String(initialTask?.estimateMinutes ?? 25));
  const [restMinutes, setRestMinutes] = useState(String(initialTask?.restMinutes ?? 5));
  const [deadline, setDeadline] = useState(dateInputValue(initialTask?.deadlineAt));
  const [targetAmount, setTargetAmount] = useState(initialTask?.targetAmount == null ? '' : String(initialTask.targetAmount));
  const [targetUnit, setTargetUnit] = useState(initialTask?.targetUnit ?? '页');
  const [mustDo, setMustDo] = useState(initialTask?.mustDo ?? false);
  const [forcedTriggerTime, setForcedTriggerTime] = useState(initialTask?.forcedTriggerTime ?? '20:00');
  const [showMore, setShowMore] = useState(Boolean(initialTask));
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    const parsedDeadline = deadline ? Date.parse(`${deadline}T23:59:59`) : null;
    setSubmitError(null);
    const result = await onSubmit({
      title: title.trim(), category: initialTask?.category ?? '未分类', kind,
      timerMode: kind === 'goal' ? 'countdown' : timerMode,
      estimateMinutes: Number(minutes), restMinutes: Number(restMinutes),
      deadlineAt: Number.isFinite(parsedDeadline) ? parsedDeadline : null,
      targetAmount: kind === 'goal' ? Number(targetAmount) : null,
      targetUnit: kind === 'goal' ? targetUnit.trim() : null,
      mustDo, forcedTriggerTime: mustDo ? forcedTriggerTime : null,
      trustLevel: initialTask?.trustLevel ?? 'medium',
    });
    if (result.ok) {
      if (!initialTask) setTitle('');
      onSuccess(result);
    } else {
      setSubmitError(result.error);
    }
  };

  return <View className="gap-3"><Field label="任务名" value={title} onChange={setTitle} placeholder="例如：完成物理作业" />{kind === 'goal' ? <Text type="body-sm" color="muted">计时方式：倒计时</Text> : <ChoiceRow value={timerMode} options={[["countdown", "倒计时"], ["countup", "正计时"], ["untimed", "不计时"]]} onChange={(value) => setTimerMode(value as TimerMode)} />}{timerMode === 'countdown' || kind === 'goal' ? <Field label={kind === 'goal' ? '单次专注分钟' : '专注分钟'} value={minutes} onChange={setMinutes} keyboard="numeric" /> : null}<Button variant="secondary" onPress={() => setShowMore((value) => !value)}>{showMore ? '收起更多设置' : '更多设置'}</Button>{showMore ? <View className="gap-3">{!initialTask ? <ChoiceRow value={kind} options={[["pomodoro", "普通任务"], ["goal", "定目标"]]} onChange={(value) => setKind(value as TaskKind)} /> : null}{kind === 'goal' ? <><Field label="截止日期" value={deadline} onChange={setDeadline} placeholder="YYYY-MM-DD" /><View className="flex-row gap-2"><View className="flex-1"><Field label="目标量" value={targetAmount} onChange={setTargetAmount} placeholder="例如 30" keyboard="numeric" /></View><View className="flex-1"><Field label="单位" value={targetUnit} onChange={setTargetUnit} placeholder="页/个/套/小时/次" /></View></View></> : null}<Field label="休息分钟" value={restMinutes} onChange={setRestMinutes} keyboard="numeric" /><Button variant={mustDo ? 'danger-soft' : 'secondary'} onPress={() => setMustDo((value) => !value)}>{mustDo ? '今日必须，按时强制锁机' : '设为今日必须'}</Button>{mustDo ? <Field label="强制触发时间" value={forcedTriggerTime} onChange={setForcedTriggerTime} placeholder="HH:mm" /> : null}</View> : null}{submitError ? <Text type="body-sm" color="danger" accessibilityRole="alert">{submitError}</Text> : null}<Button isDisabled={!title.trim()} onPress={() => void submit()}>{submitLabel}</Button>{!title.trim() ? <Text type="body-xs" color="muted">填写任务名后即可保存</Text> : null}</View>;
}

export function TaskList({ tasks, activeSession = null, onStart, onOpenActions }: {
  tasks: Task[];
  activeSession?: ActiveSession | null;
  onStart(taskId: string, mode: SessionMode): void;
  onOpenActions?(taskId: string): void;
}) {
  return <View className="gap-2">{tasks.length === 0 ? <Card><Card.Body><Card.Title>还没有任务</Card.Title><Card.Description>创建一个最小任务，开始今天的闭环。</Card.Description></Card.Body></Card> : tasks.map((task) => <TaskCard key={task.id} task={task} activeSession={activeSession} onStart={onStart} onOpenActions={onOpenActions} />)}</View>;
}

export function TaskActionPanel({ task, records, activeSession, onEdit, onConfigureFocus, onGoalProgress }: {
  task: Task;
  records: FocusSessionRecord[];
  activeSession: ActiveSession | null;
  onEdit(): void;
  onConfigureFocus(): void;
  onGoalProgress(amount: number): Promise<void>;
}) {
  const [progress, setProgress] = useState('1');
  const statistics = taskSessionStatistics(records, task.id);
  const executionState = getTaskExecutionState(task, activeSession);
  const canEdit = !['local_active', 'remote_active', 'stale_active', 'sync_conflict'].includes(executionState);
  const canFocus = executionState === 'available' || executionState === 'local_active';
  return <View className="gap-4"><View className="flex-row gap-3"><Metric label="完成专注" value={`${statistics.completedSessions} 次`} /><Metric label="累计专注" value={`${statistics.completedMinutes} 分钟`} /></View><View className="flex-row gap-2"><Button className="flex-1" variant="secondary" isDisabled={!canEdit} onPress={onEdit}>编辑任务</Button><Button className="flex-1" variant="secondary" isDisabled={!canFocus} onPress={onConfigureFocus}>专注设置</Button></View>{!canEdit ? <Text type="body-xs" color="muted">任务执行中或存在同步问题，暂时不能编辑。</Text> : null}{task.kind === 'goal' && executionState === 'available' ? <View className="flex-row items-end gap-2"><View className="flex-1"><Field label={`补记完成量（${task.targetUnit}）`} value={progress} onChange={setProgress} keyboard="numeric" /></View><Button size="sm" onPress={() => void onGoalProgress(Number(progress))}>记录</Button></View> : null}</View>;
}

function TaskCard({ task, activeSession, onStart, onOpenActions }: { task: Task; activeSession: ActiveSession | null; onStart(taskId: string, mode: SessionMode): void; onOpenActions?(taskId: string): void }) {
  const executionState = getTaskExecutionState(task, activeSession);
  const canStart = executionState === 'available' || executionState === 'local_active';
  const reason = taskExecutionReason(executionState);
  return <Pressable accessible={false} delayLongPress={320} onLongPress={() => { Vibration.vibrate(20); onOpenActions?.(task.id); }}><Card style={styles.taskCard}><Card.Body style={styles.taskBody}><View className="flex-row items-center gap-2"><View className="min-w-0 flex-1 gap-1"><Text type="body-sm" weight="semibold" numberOfLines={2}>{task.title}</Text><View className="flex-row flex-wrap items-center gap-2">{task.mustDo ? <MustDoLabel time={task.forcedTriggerTime} /> : null}<Text type="body-xs" color="muted" numberOfLines={1}>{reason && executionState !== 'completed' ? reason : compactTaskMeta(task, executionState)}</Text></View></View><MoreButton label={`${task.title}更多操作`} onPress={() => onOpenActions?.(task.id)} /><StartButton label={`${executionState === 'local_active' ? '继续' : '开始'}${task.title}专注`} disabled={!canStart} onPress={() => onStart(task.id, 'focus')} /></View></Card.Body></Card></Pressable>;
}

function MustDoLabel({ time }: { time: string | null }) {
  return <View className="flex-row items-center gap-1"><Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth={2.2}><Rect x={5} y={10} width={14} height={10} rx={2} /><Path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg><Text type="body-xs" color="danger">今日必须 {time ?? ''}</Text></View>;
}

function MoreButton({ label, onPress }: { label: string; onPress(): void }) {
  const dark = useColorScheme() === 'dark';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.iconButton, dark && styles.iconButtonDark, pressed && styles.pressed]}><Svg width={20} height={20} viewBox="0 0 24 24" fill={dark ? '#D4D4D8' : '#525252'}><Circle cx={5} cy={12} r={1.7} /><Circle cx={12} cy={12} r={1.7} /><Circle cx={19} cy={12} r={1.7} /></Svg></Pressable>;
}

function StartButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} hitSlop={4} onPress={onPress} style={({ pressed }) => [styles.startButton, disabled && styles.startButtonDisabled, pressed && !disabled && styles.pressed]}><Svg width={18} height={18} viewBox="0 0 24 24" fill="#FFFFFF"><Polygon points="8,5 19,12 8,19" /></Svg></Pressable>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View className="flex-1 rounded-panel-inner bg-surface-secondary p-3"><Text type="body-xs" color="muted">{label}</Text><Text type="body-sm" weight="semibold">{value}</Text></View>;
}

function Field({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange(value: string): void; placeholder?: string; keyboard?: 'numeric' }) {
  return <TextField><Label>{label}</Label><Input value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboard} /></TextField>;
}

function ChoiceRow({ value, options, onChange }: { value: string; options: [string, string][]; onChange(value: string): void }) {
  return <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">{options.map(([id, label]) => <Button key={id} size="sm" variant={value === id ? 'primary' : 'secondary'} accessibilityRole="radio" accessibilityState={{ selected: value === id }} onPress={() => onChange(id)}>{label}</Button>)}</View>;
}

function compactTaskMeta(task: Task, executionState: ReturnType<typeof getTaskExecutionState>) {
  if (executionState === 'completed') return '已完成';
  if (task.kind === 'goal') return `目标 ${task.completedAmount}/${task.targetAmount ?? 0} ${task.targetUnit ?? ''} · ${task.estimateMinutes} 分钟`;
  return task.timerMode === 'untimed' ? '不计时' : `${task.estimateMinutes} 分钟`;
}

function dateInputValue(value?: number | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  taskCard: { borderRadius: 8 },
  taskBody: { paddingHorizontal: 12, paddingVertical: 10 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#F1F1F1' },
  iconButtonDark: { backgroundColor: '#30333A' },
  startButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#2563EB' },
  startButtonDisabled: { backgroundColor: '#A3A3A3', opacity: 0.7 },
  pressed: { opacity: 0.75 },
});
