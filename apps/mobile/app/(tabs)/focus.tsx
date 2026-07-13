import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { FocusPanel } from '@/modules/focus-session/components/FocusPanel';
import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';
import { getTaskExecutionState, taskExecutionReason } from '@/modules/tasks/task.execution';
import { TaskCreateForm } from '@/modules/tasks/components/TasksPanel';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';

export default function FocusRoute() {
  const router = useRouter();
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const tasks = useTaskStore((state) => state.tasks);
  const activeSession = useTaskStore((state) => state.activeSession);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectedMode = useTaskStore((state) => state.selectedMode);
  const strictOptions = useTaskStore((state) => state.strictOptions);
  const error = useTaskStore((state) => state.error);
  const selectTask = useTaskStore((state) => state.selectTask);
  const selectMode = useTaskStore((state) => state.selectMode);
  const toggleStrictOption = useTaskStore((state) => state.toggleStrictOption);
  const startSession = useTaskStore((state) => state.startSession);
  const createTask = useTaskStore((state) => state.createTask);
  const capabilities = useLockEngineStore((state) => state.capabilities);
  const refresh = useLockEngineStore((state) => state.refresh);
  const confirmRisk = useLockEngineStore((state) => state.confirmRisk);
  const open = useLockEngineStore((state) => state.open);
  useEffect(() => { void refresh(); }, [refresh]);
  const focusTasks = useMemo(() => tasks.filter((task) => !['completed', 'archived'].includes(task.status)), [tasks]);
  const selectableTasks = useMemo(() => focusTasks.filter((task) => ['available', 'local_active'].includes(getTaskExecutionState(task, activeSession))), [activeSession, focusTasks]);
  const selectedTask = selectableTasks.find((task) => task.id === selectedTaskId) ?? selectableTasks[0] ?? null;
  const start = async () => { if (!selectedTask) return; await startSession(selectedTask.id, selectedMode); if (taskStore.getState().activeSession) router.push('/session'); };
  return <Screen><PageHeader title="专注" description="选择一个任务和执行强度，计时将在独立全屏页面进行。" />{focusTasks.length ? <Card><Card.Body className="gap-3"><Card.Title>选择任务</Card.Title><View className="gap-2">{focusTasks.map((task) => { const state = getTaskExecutionState(task, activeSession); const selectable = state === 'available' || state === 'local_active'; return <View key={task.id} className="gap-1"><Button size="sm" variant={selectedTask?.id === task.id ? 'primary' : 'secondary'} isDisabled={!selectable} onPress={() => selectTask(task.id)}>{task.title}</Button>{!selectable ? <Text type="body-xs" color="muted">{taskExecutionReason(state)}</Text> : null}</View>; })}</View></Card.Body></Card> : <Card><Card.Body className="gap-3"><Card.Title>暂无可专注任务</Card.Title><Card.Description>先创建一个今日任务，再回来开始专注。</Card.Description><Button onPress={() => setTaskSheetOpen(true)}>创建任务</Button></Card.Body></Card>}{error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}<FocusPanel selectedMode={selectedMode} strictOptions={strictOptions} selectedTask={selectedTask} onModeChange={selectMode} onStrictOptionToggle={toggleStrictOption} onStart={() => void start()} lockCapabilities={capabilities} onRefreshLockCapabilities={() => void refresh()} onConfirmLockRisk={() => void confirmRisk()} onOpenLockPermission={(kind) => void open(kind)} /><BottomSheetModal visible={taskSheetOpen} title="创建任务" onClose={() => setTaskSheetOpen(false)}><TaskCreateForm onCreate={createTask} onCreated={() => setTaskSheetOpen(false)} /></BottomSheetModal></Screen>;
}
