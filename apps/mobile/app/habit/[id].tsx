import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { HabitEditForm } from '@/modules/habits/components/HabitsPanel';
import { selectHabitHistory, useHabitStore } from '@/modules/habits/habit.store';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function HabitDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const habit = useHabitStore((state) => state.habits.find((item) => item.id === id) ?? null);
  const history = useHabitStore((state) => selectHabitHistory(state, id));
  const update = useHabitStore((state) => state.updateHabit);
  const loadHistory = useHabitStore((state) => state.loadHistory);
  const archive = useHabitStore((state) => state.archiveHabit);
  const error = useHabitStore((state) => state.error);
  useEffect(() => { if (id) void loadHistory(id); }, [id, loadHistory]);
  if (!habit) return <Screen><PageHeader title="习惯详情" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><Text type="body-sm" color="muted">习惯不存在或已归档</Text></Screen>;
  return <Screen><PageHeader title={habit.name} description={`今日 ${habit.todayMinutes}/${habit.targetMinutes} 分钟`} action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} />{error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}<Card><Card.Body className="gap-3"><Card.Title>习惯设置</Card.Title><Card.Description>{habit.forceEnabled ? `${habit.triggerTime} 未完成时强制触发` : '不参与强制触发'}</Card.Description><Button size="sm" onPress={() => setEditOpen(true)}>编辑习惯</Button></Card.Body></Card><Card variant="secondary"><Card.Body className="gap-3"><Card.Title>最近记录</Card.Title>{history.length ? history.map((item) => <View key={item.date} className="flex-row justify-between gap-3"><Text type="body-sm">{item.date}</Text><Text type="body-sm" weight="semibold">{item.minutes} 分钟</Text></View>) : <Text type="body-sm" color="muted">还没有历史记录</Text>}</Card.Body></Card><Button variant="danger-soft" onPress={() => void archive(habit.id).then((result) => { if (result.ok) router.back(); })}>归档习惯</Button><BottomSheetModal visible={editOpen} title="编辑习惯" onClose={() => setEditOpen(false)}><HabitEditForm habit={habit} onSave={(input) => update(habit.id, input)} onSaved={() => setEditOpen(false)} /></BottomSheetModal></Screen>;
}
