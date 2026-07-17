import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FocusPanel } from '@/modules/focus-session/components/FocusPanel';
import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { localStatistics } from '@/modules/scoring/scoring.local';
import { CategoryManager, TaskActionPanel, TaskCreateForm, TaskEditForm, TaskList } from '@/modules/tasks/components/TasksPanel';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';
import type { Task } from '@/modules/tasks/task.types';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Card, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

type TaskSheet =
  | { mode: 'actions'; taskId: string }
  | { mode: 'edit'; taskId: string; snapshot: Task }
  | { mode: 'focus'; taskId: string };

export default function TasksRoute() {
  const router = useRouter();
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [taskSheet, setTaskSheet] = useState<TaskSheet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const categories = useTaskStore((state) => state.categories);
  const records = useTaskStore((state) => state.sessionRecords);
  const activeSession = useTaskStore((state) => state.activeSession);
  const selectedMode = useTaskStore((state) => state.selectedMode);
  const strictOptions = useTaskStore((state) => state.strictOptions);
  const error = useTaskStore((state) => state.error);
  const createTask = useTaskStore((state) => state.createTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const createCategory = useTaskStore((state) => state.createCategory);
  const updateCategory = useTaskStore((state) => state.updateCategory);
  const deleteCategory = useTaskStore((state) => state.deleteCategory);
  const startSession = useTaskStore((state) => state.startSession);
  const addGoalProgress = useTaskStore((state) => state.addGoalProgress);
  const selectTask = useTaskStore((state) => state.selectTask);
  const selectMode = useTaskStore((state) => state.selectMode);
  const toggleStrictOption = useTaskStore((state) => state.toggleStrictOption);
  const capabilities = useLockEngineStore((state) => state.capabilities);
  const refreshCapabilities = useLockEngineStore((state) => state.refresh);
  const confirmRisk = useLockEngineStore((state) => state.confirmRisk);
  const openPermission = useLockEngineStore((state) => state.open);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.status !== 'archived' && (categoryFilter === 'all' || (categoryFilter === 'uncategorized' ? !task.categoryId : task.categoryId === categoryFilter))), [categoryFilter, tasks]);
  const pendingTasks = visibleTasks.filter((task) => task.status !== 'completed');
  const completedTasks = visibleTasks.filter((task) => task.status === 'completed');
  const sheetTask = taskSheet ? tasks.find((task) => task.id === taskSheet.taskId) ?? null : null;
  const completedToday = localStatistics(records).todayCompleted;

  const start = async (taskId: string, mode: 'focus' | 'lock') => {
    await startSession(taskId, mode);
    if (taskStore.getState().activeSession?.taskId !== taskId) return;
    setTaskSheet(null);
    router.push('/session');
  };
  const openFocusSettings = (taskId: string) => {
    selectTask(taskId);
    setTaskSheet({ mode: 'focus', taskId });
    void refreshCapabilities();
  };

  const sheetTitle = taskSheet?.mode === 'edit' ? '编辑任务' : taskSheet?.mode === 'focus' ? '专注设置' : sheetTask?.title ?? '任务操作';

  return <Screen>
    <PageHeader title="任务" description={new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())} action={<Button size="sm" onPress={() => setCreateOpen(true)}>创建任务</Button>} />
    <View className="flex-row gap-3"><Summary label="待办" value={`${pendingTasks.length}`} /><Summary label="今日完成" value={`${completedToday}`} /></View>
    <View className="flex-row flex-wrap gap-2"><Button size="sm" variant={categoryFilter === 'all' ? 'primary' : 'secondary'} onPress={() => setCategoryFilter('all')}>全部</Button><Button size="sm" variant={categoryFilter === 'uncategorized' ? 'primary' : 'secondary'} onPress={() => setCategoryFilter('uncategorized')}>未分类</Button>{categories.map((category) => <Button key={category.id} size="sm" variant={categoryFilter === category.id ? 'primary' : 'secondary'} onPress={() => setCategoryFilter(category.id)}>{category.name}</Button>)}<Button size="sm" variant="secondary" onPress={() => setCategoriesOpen(true)}>管理分类</Button></View>
    {notice ? <Card variant="secondary"><Card.Body className="flex-row items-center justify-between gap-3"><Text type="body-sm">{notice}</Text><Text type="body-xs" color="muted" onPress={() => setNotice(null)}>关闭</Text></Card.Body></Card> : null}
    {error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}
    <TaskList tasks={pendingTasks} activeSession={activeSession} onStart={(taskId, mode) => void start(taskId, mode)} onOpenActions={(taskId) => setTaskSheet({ mode: 'actions', taskId })} />
    {completedTasks.length ? <View className="gap-3"><Button variant="secondary" onPress={() => setCompletedExpanded((value) => !value)}>{completedExpanded ? '收起已完成' : `查看已完成（${completedTasks.length}）`}</Button>{completedExpanded ? <TaskList tasks={completedTasks} activeSession={activeSession} onStart={(taskId, mode) => void start(taskId, mode)} onOpenActions={(taskId) => setTaskSheet({ mode: 'actions', taskId })} /> : null}</View> : null}

    <BottomSheetModal visible={createOpen} title="创建任务" onClose={() => setCreateOpen(false)}><TaskCreateForm categories={categories} onCreate={createTask} onCreated={() => { setCreateOpen(false); setNotice('任务已创建'); }} /></BottomSheetModal>
    <BottomSheetModal visible={categoriesOpen} title="管理分类" onClose={() => setCategoriesOpen(false)}><CategoryManager categories={categories} onCreate={createCategory} onUpdate={updateCategory} onDelete={async (id, version) => { const result = await deleteCategory(id, version); if (result.ok && categoryFilter === id) setCategoryFilter('all'); return result; }} /></BottomSheetModal>
    <BottomSheetModal visible={Boolean(sheetTask)} title={sheetTitle} onClose={() => setTaskSheet(null)}>
      {sheetTask && taskSheet?.mode === 'actions' ? <TaskActionPanel task={sheetTask} records={records} activeSession={activeSession}
        onEdit={() => setTaskSheet({ mode: 'edit', taskId: sheetTask.id, snapshot: { ...sheetTask } })}
        onConfigureFocus={() => openFocusSettings(sheetTask.id)}
        onDelete={async () => { const result = await deleteTask(sheetTask.id, sheetTask.version); if (result.ok) { setTaskSheet(null); setNotice('任务已删除'); } }}
        onGoalProgress={async (amount) => { await addGoalProgress(sheetTask.id, amount); if (!taskStore.getState().error) setNotice('目标进度已更新'); }} /> : null}
      {taskSheet?.mode === 'edit' ? <TaskEditForm task={taskSheet.snapshot} categories={categories}
        onUpdate={(input) => updateTask(taskSheet.taskId, taskSheet.snapshot.version, input)}
        onUpdated={() => { setTaskSheet(null); setNotice('任务已更新'); }} /> : null}
      {sheetTask && taskSheet?.mode === 'focus' ? <FocusPanel selectedMode={selectedMode} strictOptions={strictOptions} selectedTask={sheetTask}
        onModeChange={selectMode} onStrictOptionToggle={toggleStrictOption} onStart={() => void start(sheetTask.id, selectedMode)}
        lockCapabilities={capabilities} onRefreshLockCapabilities={() => void refreshCapabilities()}
        onConfirmLockRisk={() => void confirmRisk()} onOpenLockPermission={(kind) => void openPermission(kind)} /> : null}
    </BottomSheetModal>
  </Screen>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Card style={{ flex: 1 }}><Card.Body className="gap-1"><Text type="body-xs" color="muted">{label}</Text><Text type="h4" weight="bold">{value}</Text></Card.Body></Card>;
}
