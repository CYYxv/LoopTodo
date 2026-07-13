import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { FocusPanel } from '@/modules/focus-session/components/FocusPanel';
import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function FocusRoute() {
  const router = useRouter();
  const tasks = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectedMode = useTaskStore((state) => state.selectedMode);
  const strictOptions = useTaskStore((state) => state.strictOptions);
  const error = useTaskStore((state) => state.error);
  const selectTask = useTaskStore((state) => state.selectTask);
  const selectMode = useTaskStore((state) => state.selectMode);
  const toggleStrictOption = useTaskStore((state) => state.toggleStrictOption);
  const startSession = useTaskStore((state) => state.startSession);
  const capabilities = useLockEngineStore((state) => state.capabilities);
  const refresh = useLockEngineStore((state) => state.refresh);
  const confirmRisk = useLockEngineStore((state) => state.confirmRisk);
  const open = useLockEngineStore((state) => state.open);
  useEffect(() => { void refresh(); }, [refresh]);
  const pendingTasks = useMemo(() => tasks.filter((task) => task.status === 'pending' && !task.remoteActive), [tasks]);
  const selectedTask = pendingTasks.find((task) => task.id === selectedTaskId) ?? pendingTasks[0] ?? null;
  const start = async () => { if (!selectedTask) return; await startSession(selectedTask.id, selectedMode); if (taskStore.getState().activeSession) router.push('/session'); };
  return <Screen><PageHeader title="专注" description="选择一个任务和执行强度，计时将在独立全屏页面进行。" />{pendingTasks.length ? <Card><Card.Body className="gap-3"><Card.Title>选择任务</Card.Title><View className="flex-row flex-wrap gap-2">{pendingTasks.map((task) => <Button key={task.id} size="sm" variant={selectedTask?.id === task.id ? 'primary' : 'secondary'} onPress={() => selectTask(task.id)}>{task.title}</Button>)}</View></Card.Body></Card> : <Card><Card.Body className="gap-3"><Card.Title>暂无可专注任务</Card.Title><Card.Description>先创建一个今日任务，再回来开始专注。</Card.Description><Button onPress={() => router.push('/create-task')}>创建任务</Button></Card.Body></Card>}{error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}<FocusPanel selectedMode={selectedMode} strictOptions={strictOptions} selectedTask={selectedTask} onModeChange={selectMode} onStrictOptionToggle={toggleStrictOption} onStart={() => void start()} lockCapabilities={capabilities} onRefreshLockCapabilities={() => void refresh()} onConfirmLockRisk={() => void confirmRisk()} onOpenLockPermission={(kind) => void open(kind)} /></Screen>;
}
