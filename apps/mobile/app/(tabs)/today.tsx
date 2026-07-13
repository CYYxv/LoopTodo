import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useHabitStore } from '@/modules/habits/habit.store';
import { localStatistics } from '@/modules/scoring/scoring.local';
import { TaskList } from '@/modules/tasks/components/TasksPanel';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function TodayRoute() {
  const router = useRouter();
  const tasks = useTaskStore((state) => state.tasks);
  const records = useTaskStore((state) => state.sessionRecords);
  const activeSession = useTaskStore((state) => state.activeSession);
  const error = useTaskStore((state) => state.error);
  const startSession = useTaskStore((state) => state.startSession);
  const addGoalProgress = useTaskStore((state) => state.addGoalProgress);
  const habits = useHabitStore((state) => state.habits);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.status !== 'archived'), [tasks]);
  const completedToday = localStatistics(records).todayCompleted;
  const start = async (taskId: string) => { await startSession(taskId, 'focus'); if (taskStore.getState().activeSession) router.push('/session'); };
  return <Screen><PageHeader title="今日" description={new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())} action={<Button size="sm" onPress={() => router.push('/create-task')}>创建任务</Button>} /><View className="flex-row gap-3"><Summary label="待办" value={`${visibleTasks.filter((task) => task.status === 'pending').length}`} /><Summary label="今日完成" value={`${completedToday}`} /><Summary label="习惯" value={`${habits.length}`} /></View>{error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}<TaskList tasks={visibleTasks} activeSession={activeSession} onStart={(taskId) => void start(taskId)} onGoalProgress={addGoalProgress} /><Card variant="secondary"><Card.Body className="gap-3"><View><Card.Title>今日习惯</Card.Title><Card.Description>{habits.length ? `${habits.length} 个习惯等待推进` : '建立一个每天可完成的小目标'}</Card.Description></View><Button variant="secondary" onPress={() => router.push('/habits')}>查看与管理习惯</Button></Card.Body></Card></Screen>;
}

function Summary({ label, value }: { label: string; value: string }) { return <Card style={{ flex: 1 }}><Card.Body className="gap-1"><Text type="body-xs" color="muted">{label}</Text><Text type="h4" weight="bold">{value}</Text></Card.Body></Card>; }
