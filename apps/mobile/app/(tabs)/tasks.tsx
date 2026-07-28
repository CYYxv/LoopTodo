import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { Surface } from 'heroui-native/surface';

import { localStatistics } from '@/modules/scoring/scoring.local';
import { lockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { CategoryManager, TaskActionPanel, TaskCreateForm, TaskEditForm, TaskGroups } from '@/modules/tasks/components/TasksPanel';
import { restrictionMissingCapabilities, taskStore, useTaskStore } from '@/modules/tasks/task.store';
import type { RestrictionPermissionKind } from '@/modules/tasks/task.store';
import type { Task } from '@/modules/tasks/task.types';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

type TaskSheet =
  | { mode: 'actions'; taskId: string }
  | { mode: 'edit'; taskId: string; snapshot: Task };

export default function TasksRoute() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [taskSheet, setTaskSheet] = useState<TaskSheet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missingCapabilities, setMissingCapabilities] = useState<RestrictionPermissionKind[]>([]);
  const tasks = useTaskStore((state) => state.tasks);
  const scanFamilyAnomalies = useTaskStore((state) => state.scanFamilyAnomalies);
  const categories = useTaskStore((state) => state.categories);
  const records = useTaskStore((state) => state.sessionRecords);
  const activeSession = useTaskStore((state) => state.activeSession);
  const error = useTaskStore((state) => state.error);
  const createTask = useTaskStore((state) => state.createTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const createCategory = useTaskStore((state) => state.createCategory);
  const updateCategory = useTaskStore((state) => state.updateCategory);
  const deleteCategory = useTaskStore((state) => state.deleteCategory);
  const startSession = useTaskStore((state) => state.startSession);
  const addGoalProgress = useTaskStore((state) => state.addGoalProgress);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.status !== 'archived'), [tasks]);
  const pendingTasks = visibleTasks.filter((task) => task.status !== 'completed');
  const sheetTask = taskSheet ? tasks.find((task) => task.id === taskSheet.taskId) ?? null : null;
  const completedToday = localStatistics(records).todayCompleted;

  const start = async (taskId: string, mode: 'focus' | 'lock') => {
    const result = await startSession(taskId, mode);
    if (!result.ok) {
      if (result.missingCapabilities.length > 0) {
        setTaskSheet(null);
        setMissingCapabilities([...result.missingCapabilities]);
      }
      return;
    }
    if (taskStore.getState().activeSession?.taskId !== taskId) return;
    setTaskSheet(null);
    router.push('/session');
  };
  const sheetTitle = taskSheet?.mode === 'edit' ? '编辑任务' : sheetTask?.title ?? '任务操作';

  useEffect(() => {
    void scanFamilyAnomalies();
    const timer = setInterval(() => { void scanFamilyAnomalies(); }, 5 * 60_000);
    return () => clearInterval(timer);
  }, [scanFamilyAnomalies]);

  useEffect(() => {
    if (missingCapabilities.length === 0) return;
    let cancelled = false;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        await lockEngineStore.getState().refresh();
        if (cancelled) return;
        const capabilities = lockEngineStore.getState().capabilities;
        if (!capabilities) return;
        const remaining = restrictionMissingCapabilities(capabilities);
        setMissingCapabilities(remaining);
        if (remaining.length === 0) setNotice('权限已恢复，可以重新开始专注');
      })();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [missingCapabilities.length]);

  return <Screen>
    <PageHeader title="任务" description={new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())} action={<Button size="sm" onPress={() => setCreateOpen(true)}>创建任务</Button>} />
    <View className="flex-row gap-3"><Summary label="待办" value={`${pendingTasks.length}`} /><Summary label="今日完成" value={`${completedToday}`} /></View>
    <View className="items-end"><Button size="sm" variant="secondary" onPress={() => setCategoriesOpen(true)}>管理分类</Button></View>
    {notice ? <Card variant="secondary"><Card.Body className="flex-row items-center justify-between gap-3"><Text type="body-sm">{notice}</Text><Text type="body-xs" color="muted" onPress={() => setNotice(null)}>关闭</Text></Card.Body></Card> : null}
    {error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}
    <TaskGroups tasks={visibleTasks} categories={categories} activeSession={activeSession} onStart={(taskId, mode) => void start(taskId, mode)} onOpenActions={(taskId) => setTaskSheet({ mode: 'actions', taskId })} />

    <BottomSheetModal visible={createOpen} title="创建任务" onClose={() => setCreateOpen(false)}><TaskCreateForm categories={categories} onCreate={createTask} onCreated={() => { setCreateOpen(false); setNotice('任务已创建'); }} /></BottomSheetModal>
    <BottomSheetModal visible={categoriesOpen} title="管理分类" onClose={() => setCategoriesOpen(false)}><CategoryManager categories={categories} onCreate={createCategory} onUpdate={updateCategory} onDelete={(id, version) => deleteCategory(id, version)} /></BottomSheetModal>
    <BottomSheetModal visible={Boolean(sheetTask)} title={sheetTitle} onClose={() => setTaskSheet(null)}>
      {sheetTask && taskSheet?.mode === 'actions' ? <TaskActionPanel task={sheetTask} records={records} activeSession={activeSession}
        onEdit={() => setTaskSheet({ mode: 'edit', taskId: sheetTask.id, snapshot: { ...sheetTask } })}
        onStart={() => void start(sheetTask.id, 'focus')}
        onDelete={async () => { const result = await deleteTask(sheetTask.id, sheetTask.version); if (result.ok) { setTaskSheet(null); setNotice('任务已删除'); } }}
        onGoalProgress={async (amount) => { await addGoalProgress(sheetTask.id, amount); if (!taskStore.getState().error) setNotice('目标进度已更新'); }} /> : null}
      {taskSheet?.mode === 'edit' ? <TaskEditForm task={taskSheet.snapshot} categories={categories}
        onUpdate={(input) => updateTask(taskSheet.taskId, taskSheet.snapshot.version, input)}
        onUpdated={() => { setTaskSheet(null); setNotice('任务已更新'); }} /> : null}
    </BottomSheetModal>
    <BottomSheetModal visible={missingCapabilities.length > 0} title="恢复软件限制权限" onClose={() => setMissingCapabilities([])}>
      <Text type="body-sm" color="muted">恢复缺失权限后，再次开始专注。</Text>
      {missingCapabilities.includes('usageAccess') ? (
        <Button variant="secondary" accessibilityLabel="允许查看应用使用情况" onPress={() => void lockEngineStore.getState().open('usageAccess')}>允许查看应用使用情况</Button>
      ) : null}
      {missingCapabilities.includes('overlay') ? (
        <Button variant="secondary" accessibilityLabel="允许显示在其他应用上层" onPress={() => void lockEngineStore.getState().open('overlay')}>允许显示在其他应用上层</Button>
      ) : null}
      {missingCapabilities.includes('vendorBackground') ? (
        <Button variant="secondary" accessibilityLabel="打开厂商后台设置" onPress={() => void lockEngineStore.getState().open('vendorBackground')}>打开厂商后台设置</Button>
      ) : null}
    </BottomSheetModal>
  </Screen>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Surface variant="secondary" style={{ flex: 1 }} className="rounded-3xl border border-border/60 p-4"><Text type="body-xs" color="muted">{label}</Text><Text type="h3" weight="bold" color="accent">{value}</Text></Surface>;
}
