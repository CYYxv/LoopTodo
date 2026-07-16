import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FocusPanel } from '@/modules/focus-session/components/FocusPanel';
import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { localStatistics } from '@/modules/scoring/scoring.local';
import { TaskCreateForm, TaskList } from '@/modules/tasks/components/TasksPanel';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function TasksRoute() {
  const router = useRouter();
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const records = useTaskStore((state) => state.sessionRecords);
  const activeSession = useTaskStore((state) => state.activeSession);
  const selectedMode = useTaskStore((state) => state.selectedMode);
  const strictOptions = useTaskStore((state) => state.strictOptions);
  const error = useTaskStore((state) => state.error);
  const createTask = useTaskStore((state) => state.createTask);
  const startSession = useTaskStore((state) => state.startSession);
  const addGoalProgress = useTaskStore((state) => state.addGoalProgress);
  const selectTask = useTaskStore((state) => state.selectTask);
  const selectMode = useTaskStore((state) => state.selectMode);
  const toggleStrictOption = useTaskStore((state) => state.toggleStrictOption);
  const capabilities = useLockEngineStore((state) => state.capabilities);
  const refreshCapabilities = useLockEngineStore((state) => state.refresh);
  const confirmRisk = useLockEngineStore((state) => state.confirmRisk);
  const openPermission = useLockEngineStore((state) => state.open);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.status !== 'archived'), [tasks]);
  const pendingTasks = visibleTasks.filter((task) => task.status !== 'completed');
  const completedTasks = visibleTasks.filter((task) => task.status === 'completed');
  const focusTask = tasks.find((task) => task.id === focusTaskId) ?? null;
  const completedToday = localStatistics(records).todayCompleted;

  const start = async (taskId: string, mode: 'focus' | 'lock') => {
    await startSession(taskId, mode);
    if (taskStore.getState().activeSession?.taskId !== taskId) return;
    setFocusTaskId(null);
    router.push('/session');
  };
  const openFocusSettings = (taskId: string) => {
    selectTask(taskId);
    setFocusTaskId(taskId);
    void refreshCapabilities();
  };

  return <Screen><PageHeader title="任务" description={new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())} action={<Button size="sm" onPress={() => setCreateOpen(true)}>创建任务</Button>} /><View className="flex-row gap-3"><Summary label="待办" value={`${pendingTasks.length}`} /><Summary label="今日完成" value={`${completedToday}`} /></View>{notice ? <Card variant="secondary"><Card.Body className="flex-row items-center justify-between gap-3"><Text type="body-sm">{notice}</Text><Text type="body-xs" color="muted" onPress={() => setNotice(null)}>关闭</Text></Card.Body></Card> : null}{error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}<TaskList tasks={pendingTasks} activeSession={activeSession} onStart={(taskId, mode) => void start(taskId, mode)} onConfigureFocus={openFocusSettings} onGoalProgress={addGoalProgress} />{completedTasks.length ? <View className="gap-3"><Button variant="secondary" onPress={() => setCompletedExpanded((value) => !value)}>{completedExpanded ? '收起已完成' : `查看已完成（${completedTasks.length}）`}</Button>{completedExpanded ? <TaskList tasks={completedTasks} activeSession={activeSession} onStart={(taskId, mode) => void start(taskId, mode)} onGoalProgress={addGoalProgress} /> : null}</View> : null}<BottomSheetModal visible={createOpen} title="创建任务" onClose={() => setCreateOpen(false)}><TaskCreateForm onCreate={createTask} onCreated={() => { setCreateOpen(false); setNotice('任务已创建'); }} /></BottomSheetModal><BottomSheetModal visible={Boolean(focusTask)} title="专注设置" onClose={() => setFocusTaskId(null)}>{focusTask ? <FocusPanel selectedMode={selectedMode} strictOptions={strictOptions} selectedTask={focusTask} onModeChange={selectMode} onStrictOptionToggle={toggleStrictOption} onStart={() => void start(focusTask.id, selectedMode)} lockCapabilities={capabilities} onRefreshLockCapabilities={() => void refreshCapabilities()} onConfirmLockRisk={() => void confirmRisk()} onOpenLockPermission={(kind) => void openPermission(kind)} /> : null}</BottomSheetModal></Screen>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Card style={{ flex: 1 }}><Card.Body className="gap-1"><Text type="body-xs" color="muted">{label}</Text><Text type="h4" weight="bold">{value}</Text></Card.Body></Card>;
}
