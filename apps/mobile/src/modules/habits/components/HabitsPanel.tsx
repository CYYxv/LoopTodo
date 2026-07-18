import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from 'heroui-native/pressable-feedback';
import { Surface } from 'heroui-native/surface';

import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import type { ArchiveHabitResult, CreateHabitResult, UpdateHabitResult } from '../habit.store';
import type { CreateHabitInput, Habit, UpdateHabitInput } from '../habit.types';

export function HabitCreateForm({ onCreate, onCreated }: { onCreate(input: CreateHabitInput): Promise<CreateHabitResult>; onCreated?(habitId: string): void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('30');
  const [forceEnabled, setForceEnabled] = useState(false);
  const [triggerTime, setTriggerTime] = useState('20:00');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const create = async () => {
    setSubmitError(null);
    const result = await onCreate({ name: name.trim(), targetMinutes: Number(target), forceEnabled, triggerTime: forceEnabled ? triggerTime : null });
    if (result.ok) { setName(''); onCreated?.(result.habitId); }
    else setSubmitError(result.error);
  };
  return <Card variant="secondary"><Card.Body className="gap-3"><Card.Title>创建习惯</Card.Title><Field label="习惯名称" value={name} onChange={setName} placeholder="例如：英语晨读" /><Field label="每日目标分钟" value={target} onChange={setTarget} keyboard="numeric" /><Button variant={forceEnabled ? 'danger-soft' : 'secondary'} onPress={() => setForceEnabled((value) => !value)}>{forceEnabled ? '已参与强制约束' : '不参与强制约束'}</Button>{forceEnabled ? <Field label="触发时间" value={triggerTime} onChange={setTriggerTime} placeholder="HH:mm" /> : null}{submitError ? <Text type="body-sm" color="danger" accessibilityRole="alert">{submitError}</Text> : null}<Button isDisabled={!name.trim()} onPress={() => void create()}>保存习惯</Button>{!name.trim() ? <Text type="body-xs" color="muted">填写习惯名称后即可保存</Text> : null}</Card.Body></Card>;
}

export function HabitEditForm({ habit, onSave, onSaved }: { habit: Habit; onSave(input: UpdateHabitInput): Promise<UpdateHabitResult>; onSaved?(): void }) {
  const [name, setName] = useState(habit.name);
  const [target, setTarget] = useState(String(habit.targetMinutes));
  const [forceEnabled, setForceEnabled] = useState(habit.forceEnabled);
  const [triggerTime, setTriggerTime] = useState(habit.triggerTime ?? '20:00');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const save = async () => {
    setSubmitError(null);
    const result = await onSave({ name: name.trim(), targetMinutes: Number(target), forceEnabled, triggerTime: forceEnabled ? triggerTime : null });
    if (result.ok) onSaved?.();
    else setSubmitError(result.error);
  };
  return <Card variant="secondary"><Card.Body className="gap-3"><Field label="习惯名称" value={name} onChange={setName} /><Field label="每日目标分钟" value={target} onChange={setTarget} keyboard="numeric" /><Button variant={forceEnabled ? 'danger-soft' : 'secondary'} onPress={() => setForceEnabled((value) => !value)}>{forceEnabled ? '今日未完成时强制触发' : '不参与强制触发'}</Button>{forceEnabled ? <Field label="触发时间" value={triggerTime} onChange={setTriggerTime} placeholder="HH:mm" /> : null}{submitError ? <Text type="body-sm" color="danger" accessibilityRole="alert">{submitError}</Text> : null}<Button isDisabled={!name.trim()} onPress={() => void save()}>保存修改</Button></Card.Body></Card>;
}

export function HabitList({ habits, onProgress, onArchive, onOpen }: { habits: Habit[]; onProgress(habitId: string, minutes: number): Promise<void>; onArchive(habitId: string): Promise<ArchiveHabitResult>; onOpen?(habitId: string): void }) {
  return <View className="gap-4">{habits.length === 0 ? <Card><Card.Body><Card.Title>还没有习惯</Card.Title><Card.Description>建立一个每天可完成的小目标。</Card.Description></Card.Body></Card> : habits.map((habit) => <HabitCard key={habit.id} habit={habit} onProgress={onProgress} onArchive={onArchive} onOpen={onOpen} />)}</View>;
}

export function HabitsPanel({ habits, onCreate, onProgress, onArchive }: { habits: Habit[]; onCreate(input: CreateHabitInput): Promise<CreateHabitResult>; onProgress(habitId: string, minutes: number): Promise<void>; onArchive(habitId: string): Promise<ArchiveHabitResult> }) {
  return <View className="gap-4"><HabitCreateForm onCreate={onCreate} /><HabitList habits={habits} onProgress={onProgress} onArchive={onArchive} /></View>;
}

function HabitCard({ habit, onProgress, onArchive, onOpen }: { habit: Habit; onProgress(id: string, minutes: number): Promise<void>; onArchive(id: string): Promise<ArchiveHabitResult>; onOpen?(habitId: string): void }) {
  const [minutes, setMinutes] = useState('10');
  const percent = Math.min(100, Math.round((habit.todayMinutes / habit.targetMinutes) * 100));
  return <Surface testID={`habit-surface-${habit.id}`} variant="secondary" className="overflow-hidden rounded-3xl border border-border/60"><PressableFeedback testID={`habit-feedback-${habit.id}`} onPress={() => onOpen?.(habit.id)} animation={{ scale: { value: 0.992 } }}><View className="gap-4 p-4"><View className="flex-row items-center justify-between gap-3"><View className="flex-1 gap-1"><Text type="body-lg" weight="semibold">{habit.name}</Text><Text type="body-sm" color="muted">今日 {habit.todayMinutes}/{habit.targetMinutes} 分钟 · {percent}%</Text></View>{habit.forceEnabled ? <Chip color="danger" variant="soft">{habit.triggerTime} 强制触发</Chip> : null}</View><View className="h-1.5 overflow-hidden rounded-full bg-default/10"><View className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} /></View><View className="flex-row flex-wrap gap-2"><Button size="sm" onPress={() => void onProgress(habit.id, 5)}>+5 分钟</Button><Button size="sm" variant="secondary" onPress={() => void onProgress(habit.id, 10)}>+10 分钟</Button>{onOpen ? <Button size="sm" variant="secondary" onPress={() => onOpen(habit.id)}>详情</Button> : null}</View><View className="flex-row items-end gap-2"><View className="flex-1"><Field label="补记分钟" value={minutes} onChange={setMinutes} keyboard="numeric" /></View><Button size="sm" variant="secondary" onPress={() => void onProgress(habit.id, Number(minutes))}>记录</Button></View><Text type="body-xs" color="muted" onPress={() => void onArchive(habit.id)}>归档习惯</Text></View></PressableFeedback></Surface>;
}

function Field({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange(value: string): void; placeholder?: string; keyboard?: 'numeric' }) {
  return <TextField><Label>{label}</Label><Input value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboard} /></TextField>;
}
