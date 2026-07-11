import { useState } from 'react';
import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Text } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

import type { CreateHabitInput, Habit } from '../habit.types';

export function HabitsPanel({ habits, onCreate, onProgress, onArchive }: {
  habits: Habit[];
  onCreate: (input: CreateHabitInput) => Promise<void>;
  onProgress: (habitId: string, minutes: number) => Promise<void>;
  onArchive: (habitId: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('30');
  const [forceEnabled, setForceEnabled] = useState(false);
  const [triggerTime, setTriggerTime] = useState('20:00');
  const create = async () => {
    await onCreate({ name, targetMinutes: Number(target), forceEnabled, triggerTime: forceEnabled ? triggerTime : null });
    setName('');
  };
  return <View className="gap-4">
    <Card variant="secondary"><Card.Body className="gap-3"><Card.Title>创建习惯</Card.Title>
      <Field label="习惯名称" value={name} onChange={setName} placeholder="例如：英语晨读" />
      <Field label="每日目标分钟" value={target} onChange={setTarget} keyboard="numeric" />
      <Button variant={forceEnabled ? 'danger-soft' : 'secondary'} onPress={() => setForceEnabled((value) => !value)}>
        {forceEnabled ? '已参与强制约束' : '不参与强制约束'}
      </Button>
      {forceEnabled ? <Field label="触发时间" value={triggerTime} onChange={setTriggerTime} placeholder="HH:mm" /> : null}
      <Button isDisabled={!name.trim()} onPress={() => void create()}>保存习惯</Button>
    </Card.Body></Card>
    {habits.length === 0 ? <Card><Card.Body><Card.Title>还没有习惯</Card.Title><Card.Description>建立一个每天可完成的小目标。</Card.Description></Card.Body></Card>
      : habits.map((habit) => <HabitCard key={habit.id} habit={habit} onProgress={onProgress} onArchive={onArchive} />)}
  </View>;
}

function HabitCard({ habit, onProgress, onArchive }: { habit: Habit; onProgress: (id: string, minutes: number) => Promise<void>; onArchive: (id: string) => Promise<void> }) {
  const [minutes, setMinutes] = useState('10');
  const percent = Math.min(100, Math.round((habit.todayMinutes / habit.targetMinutes) * 100));
  return <Card><Card.Body className="gap-3"><View className="flex-row items-center justify-between"><View><Card.Title>{habit.name}</Card.Title><Card.Description>今日 {habit.todayMinutes}/{habit.targetMinutes} 分钟 · {percent}%</Card.Description></View>
    {habit.forceEnabled ? <Chip color="danger" variant="soft">{habit.triggerTime} 强制约束</Chip> : null}</View>
    <View className="flex-row items-end gap-2"><View className="flex-1"><Field label="补记分钟" value={minutes} onChange={setMinutes} keyboard="numeric" /></View><Button size="sm" onPress={() => void onProgress(habit.id, Number(minutes))}>记录</Button></View>
    <Text type="body-xs" color="muted" onPress={() => void onArchive(habit.id)}>归档习惯</Text>
  </Card.Body></Card>;
}

function Field({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: 'numeric' }) {
  return <TextField><Label>{label}</Label><Input value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboard} /></TextField>;
}
