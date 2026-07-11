import { useState } from 'react';
import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Text } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

import type { SessionMode } from '@/modules/focus-session/focus-session.types';
import type { CreateTaskInput, Task, TaskKind, TimerMode, TrustLevel } from '@/modules/tasks/task.types';

const trustCopy: Record<TrustLevel, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  high: { label: '高可信', color: 'success' },
  medium: { label: '普通可信', color: 'warning' },
  low: { label: '开放专注', color: 'danger' },
};

export function TasksPanel({
  tasks,
  onCreateTask,
  onStart,
  onGoalProgress,
}: {
  tasks: Task[];
  onCreateTask: (input: CreateTaskInput) => Promise<void>;
  onStart: (taskId: string, mode: SessionMode) => void;
  onGoalProgress: (taskId: string, amount: number) => Promise<void>;
}) {
  return (
    <View className="gap-4">
      <TaskCreateForm onCreate={onCreateTask} />
      <View className="gap-3">
        {tasks.length === 0 ? (
          <Card><Card.Body><Card.Title>还没有任务</Card.Title><Card.Description>先创建一个最小任务闭环。</Card.Description></Card.Body></Card>
        ) : tasks.map((task) => <TaskCard key={task.id} task={task} onStart={onStart} onGoalProgress={onGoalProgress} />)}
      </View>
    </View>
  );
}

function TaskCreateForm({ onCreate }: { onCreate: (input: CreateTaskInput) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskKind>('pomodoro');
  const [timerMode, setTimerMode] = useState<TimerMode>('countdown');
  const [minutes, setMinutes] = useState('25');
  const [restMinutes, setRestMinutes] = useState('5');
  const [deadline, setDeadline] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetUnit, setTargetUnit] = useState('页');

  const submit = async () => {
    const estimateMinutes = Number(minutes);
    const parsedDeadline = deadline ? Date.parse(`${deadline}T23:59:59`) : null;
    await onCreate({
      title,
      category: '收集箱',
      kind,
      timerMode: kind === 'goal' ? 'countdown' : timerMode,
      estimateMinutes,
      restMinutes: Number(restMinutes),
      deadlineAt: Number.isFinite(parsedDeadline) ? parsedDeadline : null,
      targetAmount: kind === 'goal' ? Number(targetAmount) : null,
      targetUnit: kind === 'goal' ? targetUnit : null,
      mustDo: false,
      trustLevel: 'medium',
    });
    setTitle('');
  };

  return (
    <Card variant="secondary">
      <Card.Body className="gap-3">
        <View><Card.Title>创建任务</Card.Title><Card.Description>数据保存在本机 SQLite，重启后可恢复。</Card.Description></View>
        <ChoiceRow value={kind} options={[['pomodoro', '普通番茄钟'], ['goal', '定目标']]} onChange={(value) => setKind(value as TaskKind)} />
        <Field label="任务名" value={title} onChange={setTitle} placeholder="例如：完成物理作业" />
        {kind === 'pomodoro' ? (
          <ChoiceRow value={timerMode} options={[['countdown', '倒计时'], ['countup', '正计时'], ['untimed', '不计时']]} onChange={(value) => setTimerMode(value as TimerMode)} />
        ) : null}
        {kind === 'goal' ? (
          <><Field label="截止日期" value={deadline} onChange={setDeadline} placeholder="YYYY-MM-DD" /><View className="flex-row gap-2"><View className="flex-1"><Field label="目标量" value={targetAmount} onChange={setTargetAmount} placeholder="例如 30" keyboard="numeric" /></View><View className="flex-1"><Field label="单位" value={targetUnit} onChange={setTargetUnit} placeholder="页/个/套/小时/次" /></View></View></>
        ) : null}
        {timerMode === 'countdown' || kind === 'goal' ? <Field label={kind === 'goal' ? '单次专注分钟' : '倒计时分钟（25/35/自定义）'} value={minutes} onChange={setMinutes} keyboard="numeric" /> : null}
        <Field label="休息分钟" value={restMinutes} onChange={setRestMinutes} keyboard="numeric" />
        <Button isDisabled={!title.trim()} onPress={() => void submit()}>添加到今日待办</Button>
      </Card.Body>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: 'numeric' }) {
  return <TextField><Label>{label}</Label><Input value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboard} /></TextField>;
}

function ChoiceRow({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <View className="flex-row flex-wrap gap-2">{options.map(([id, label]) => <Button key={id} size="sm" variant={value === id ? 'primary' : 'secondary'} onPress={() => onChange(id)}>{label}</Button>)}</View>;
}

function TaskCard({ task, onStart, onGoalProgress }: { task: Task; onStart: (taskId: string, mode: SessionMode) => void; onGoalProgress: (taskId: string, amount: number) => Promise<void> }) {
  const [progress, setProgress] = useState('1');
  const trust = trustCopy[task.trustLevel];
  const canStart = task.status === 'pending';
  return (
    <Card><Card.Body className="gap-4"><View className="gap-2"><View className="flex-row flex-wrap items-center gap-2"><Chip size="sm" color={task.mustDo ? 'danger' : 'default'} variant="secondary">{task.mustDo ? '今日必须' : task.category}</Chip><Chip size="sm" color={trust.color} variant="soft">{trust.label}</Chip>{task.status === 'completed' ? <Chip size="sm" color="success" variant="soft">已完成</Chip> : null}{task.remoteActive ? <Chip size="sm" color="danger" variant="soft">其他设备专注中</Chip> : null}{task.syncStatus === 'conflict' ? <Chip size="sm" color="danger" variant="soft">同步冲突</Chip> : null}</View><Card.Title>{task.title}</Card.Title><Card.Description>{task.progressLabel}</Card.Description></View>{task.kind === 'goal' && task.status !== 'completed' && !task.remoteActive ? <View className="flex-row items-end gap-2"><View className="flex-1"><Field label={`补记完成量（${task.targetUnit}）`} value={progress} onChange={setProgress} keyboard="numeric" /></View><Button size="sm" onPress={() => void onGoalProgress(task.id, Number(progress))}>记录</Button></View> : null}<View className="flex-row items-center justify-between gap-3"><Text type="body-sm" color="muted">{task.timerMode === 'untimed' ? '不计时' : `${task.estimateMinutes} 分钟`}</Text><Button size="sm" variant="secondary" isDisabled={!canStart} accessibilityLabel={`开始${task.title}专注`} onPress={() => onStart(task.id, 'focus')}>专注</Button></View></Card.Body></Card>
  );
}
