import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { HabitCreateForm } from '@/modules/habits/components/HabitsPanel';
import { useHabitStore } from '@/modules/habits/habit.store';
import { localStatistics } from '@/modules/scoring/scoring.local';
import { TaskCreateForm, TaskList } from '@/modules/tasks/components/TasksPanel';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';
import type { Task } from '@/modules/tasks/task.types';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

type TaskFilter = 'all' | 'inbox' | 'must';

export default function TodayRoute() {
  const router = useRouter();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [habitSheetOpen, setHabitSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const records = useTaskStore((state) => state.sessionRecords);
  const activeSession = useTaskStore((state) => state.activeSession);
  const error = useTaskStore((state) => state.error);
  const createTask = useTaskStore((state) => state.createTask);
  const startSession = useTaskStore((state) => state.startSession);
  const addGoalProgress = useTaskStore((state) => state.addGoalProgress);
  const habits = useHabitStore((state) => state.habits);
  const createHabit = useHabitStore((state) => state.createHabit);
  const addHabitProgress = useHabitStore((state) => state.addProgress);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.status !== 'archived'), [tasks]);
  const filteredTasks = useMemo(() => visibleTasks.filter((task) => taskFilter === 'all' || (taskFilter === 'inbox' ? task.category === '收集箱' : task.mustDo)), [taskFilter, visibleTasks]);
  const mustTasks = filteredTasks.filter((task) => task.mustDo && task.status !== 'completed');
  const regularTasks = filteredTasks.filter((task) => !task.mustDo && task.status !== 'completed');
  const completedTasks = filteredTasks.filter((task) => task.status === 'completed');
  const completedToday = localStatistics(records).todayCompleted;
  const start = async (taskId: string) => { await startSession(taskId, 'focus'); if (taskStore.getState().activeSession) router.push('/session'); };
  const created = (message: string) => { setTaskSheetOpen(false); setHabitSheetOpen(false); setNotice(message); };

  return <Screen><PageHeader title="今日" description={new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())} action={<Button size="sm" onPress={() => setTaskSheetOpen(true)}>创建任务</Button>} /><View className="flex-row gap-3"><Summary label="待办" value={`${visibleTasks.filter((task) => !['completed', 'archived'].includes(task.status)).length}`} /><Summary label="今日完成" value={`${completedToday}`} /><Summary label="习惯" value={`${habits.length}`} /></View>{notice ? <Card variant="secondary"><Card.Body className="flex-row items-center justify-between gap-3"><Text type="body-sm">{notice}</Text><Text type="body-xs" color="muted" onPress={() => setNotice(null)}>关闭</Text></Card.Body></Card> : null}{error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}<View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup"><FilterButton id="all" label="全部" value={taskFilter} onChange={setTaskFilter} /><FilterButton id="inbox" label="收集箱" value={taskFilter} onChange={setTaskFilter} /><FilterButton id="must" label="今日必须" value={taskFilter} onChange={setTaskFilter} /></View>{mustTasks.length ? <TaskSection title="今日必须" tasks={mustTasks} activeSession={activeSession} onStart={start} onGoalProgress={addGoalProgress} /> : null}<TaskSection title="普通待办" tasks={regularTasks} activeSession={activeSession} onStart={start} onGoalProgress={addGoalProgress} empty={mustTasks.length === 0 && completedTasks.length === 0} />{completedTasks.length ? <View className="gap-3"><Button variant="secondary" onPress={() => setCompletedExpanded((value) => !value)}>{completedExpanded ? '收起已完成' : `查看已完成（${completedTasks.length}）`}</Button>{completedExpanded ? <TaskSection title="已完成" tasks={completedTasks} activeSession={activeSession} onStart={start} onGoalProgress={addGoalProgress} /> : null}</View> : null}<Card variant="secondary"><Card.Body className="gap-3"><View><Card.Title>今日习惯</Card.Title><Card.Description>{habits.length ? '快速推进今日目标' : '建立一个每天可完成的小目标'}</Card.Description></View>{habits.slice(0, 3).map((habit) => <View key={habit.id} className="flex-row items-center justify-between gap-3"><View className="flex-1"><Text type="body-sm" weight="semibold">{habit.name}</Text><Text type="body-xs" color="muted">{habit.todayMinutes}/{habit.targetMinutes} 分钟</Text></View><Button size="sm" variant="secondary" onPress={() => void addHabitProgress(habit.id, 5)}>+5 分钟</Button></View>)}<View className="flex-row flex-wrap gap-2"><Button className="flex-1" onPress={() => setHabitSheetOpen(true)}>创建习惯</Button><Button className="flex-1" variant="secondary" onPress={() => router.push('/habits')}>管理习惯</Button></View></Card.Body></Card><BottomSheetModal visible={taskSheetOpen} title="创建任务" onClose={() => setTaskSheetOpen(false)}><TaskCreateForm onCreate={createTask} onCreated={() => created('任务已创建，可立即开始专注')} /></BottomSheetModal><BottomSheetModal visible={habitSheetOpen} title="创建习惯" onClose={() => setHabitSheetOpen(false)}><HabitCreateForm onCreate={createHabit} onCreated={() => created('习惯已创建')} /></BottomSheetModal></Screen>;
}

function Summary({ label, value }: { label: string; value: string }) { return <Card style={{ flex: 1 }}><Card.Body className="gap-1"><Text type="body-xs" color="muted">{label}</Text><Text type="h4" weight="bold">{value}</Text></Card.Body></Card>; }
function FilterButton({ id, label, value, onChange }: { id: TaskFilter; label: string; value: TaskFilter; onChange(value: TaskFilter): void }) { return <Button size="sm" variant={value === id ? 'primary' : 'secondary'} accessibilityRole="radio" accessibilityState={{ selected: value === id }} onPress={() => onChange(id)}>{label}</Button>; }
function TaskSection({ title, tasks, activeSession, onStart, onGoalProgress, empty = false }: { title: string; tasks: Task[]; activeSession: ReturnType<typeof taskStore.getState>['activeSession']; onStart(taskId: string): Promise<void>; onGoalProgress(taskId: string, amount: number): Promise<void>; empty?: boolean }) { return <View className="gap-3"><Text type="h4" weight="semibold">{title}</Text>{tasks.length ? <TaskList tasks={tasks} activeSession={activeSession} onStart={(taskId) => void onStart(taskId)} onGoalProgress={onGoalProgress} /> : empty ? <Card><Card.Body><Card.Title>还没有任务</Card.Title><Card.Description>创建一个最小任务，开始今天的闭环。</Card.Description></Card.Body></Card> : null}</View>; }
