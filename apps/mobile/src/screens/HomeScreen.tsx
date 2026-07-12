import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Card, Chip, Text } from '@/ui/hero-runtime';

import { ActiveSessionScreen } from '@/modules/focus-session/components/ActiveSessionScreen';
import { HabitsPanel } from '@/modules/habits/components/HabitsPanel';
import { NotificationSettingsCard } from '@/modules/notifications/components/NotificationSettingsCard';
import { useNotificationStore } from '@/modules/notifications/notification.store';
import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { ForcedTriggerStatusCard } from '@/modules/forced-trigger/components/ForcedTriggerStatusCard';
import { useHabitStore } from '@/modules/habits/habit.store';
import { FocusPanel } from '@/modules/focus-session/components/FocusPanel';
import { FamilyPanel, SocialPanel } from '@/modules/social/components/SocialPanels';
import { SyncStatusCard } from '@/modules/sync/components/SyncStatusCard';
import { useSyncStore } from '@/modules/sync/sync.store';
import { TasksPanel } from '@/modules/tasks/components/TasksPanel';
import { useTaskStore } from '@/modules/tasks/task.store';
import { StatisticsPanel } from '@/modules/scoring/components/StatisticsPanel';
import { SubscriptionPanel } from '@/modules/subscription/components/SubscriptionPanel';
import { RewardPanel } from '@/modules/rewards/components/RewardPanel';
import { SettingsPanel } from '@/modules/settings/components/SettingsPanel';
import type { CreateTaskInput } from '@/modules/tasks/task.types';
import type { CreateTaskResult } from '@/modules/tasks/task.store';
import { AccountCard } from '@/modules/auth/components/AccountCard';
import { useAuthStore } from '@/modules/auth/auth.store';
import {
  DashboardSummary,
  Header,
  PanelTabs,
  type PanelKey,
} from '@/screens/components/DashboardChrome';

export function HomeScreen() {
  const [activePanel, setActivePanel] = useState<PanelKey>('tasks');
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const colorScheme = useColorScheme(); const { width } = useWindowDimensions();
  const tasks = useTaskStore((state) => state.tasks);
  const activeSession = useTaskStore((state) => state.activeSession);
  const sessionRecords = useTaskStore((state) => state.sessionRecords);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectedMode = useTaskStore((state) => state.selectedMode);
  const strictOptions = useTaskStore((state) => state.strictOptions);
  const error = useTaskStore((state) => state.error);
  const isHydrating = useTaskStore((state) => state.isHydrating);
  const hydrate = useTaskStore((state) => state.hydrate);
  const createTask = useTaskStore((state) => state.createTask);
  const startSession = useTaskStore((state) => state.startSession);
  const finishSession = useTaskStore((state) => state.finishSession);
  const finishRest = useTaskStore((state) => state.finishRest);
  const addGoalProgress = useTaskStore((state) => state.addGoalProgress);
  const selectMode = useTaskStore((state) => state.selectMode);
  const toggleStrictOption = useTaskStore((state) => state.toggleStrictOption);
  const clearError = useTaskStore((state) => state.clearError);
  const habits = useHabitStore((state) => state.habits);
  const hydrateHabits = useHabitStore((state) => state.hydrate);
  const createHabit = useHabitStore((state) => state.createHabit);
  const addHabitProgress = useHabitStore((state) => state.addProgress);
  const archiveHabit = useHabitStore((state) => state.archiveHabit);
  const habitError = useHabitStore((state) => state.error);
  const clearHabitError = useHabitStore((state) => state.clearError);
  const syncConfigured = useSyncStore((state) => state.configured);
  const syncPending = useSyncStore((state) => state.pending);
  const syncConflicts = useSyncStore((state) => state.conflicts);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const syncError = useSyncStore((state) => state.error);
  const hydrateSync = useSyncStore((state) => state.hydrate);
  const syncNow = useSyncStore((state) => state.syncNow);
  const resolveSyncConflict = useSyncStore((state) => state.resolveConflict);
  const notificationPermission = useNotificationStore((state) => state.permission);
  const taskRemindersEnabled = useNotificationStore((state) => state.taskRemindersEnabled);
  const notificationError = useNotificationStore((state) => state.error);
  const hydrateNotifications = useNotificationStore((state) => state.hydrate);
  const enableNotifications = useNotificationStore((state) => state.enableNotifications);
  const sendTestReminder = useNotificationStore((state) => state.sendTestReminder);
  const setTaskRemindersEnabled = useNotificationStore((state) => state.setTaskRemindersEnabled);
  const lockCapabilities = useLockEngineStore((state) => state.capabilities);
  const refreshLockCapabilities = useLockEngineStore((state) => state.refresh);
  const confirmLockRisk = useLockEngineStore((state) => state.confirmRisk);
  const openLockPermission = useLockEngineStore((state) => state.open);

  useEffect(() => {
    void hydrate();
    void hydrateHabits();
    void hydrateSync();
    void hydrateNotifications();
    void hydrateAuth();
    void refreshLockCapabilities();
  }, [hydrate, hydrateAuth, hydrateHabits, hydrateNotifications, hydrateSync, refreshLockCapabilities]);

  const todayMinutes = useMemo(
    () =>
      tasks.reduce(
        (total, task) => total + (task.status === 'pending' ? task.estimateMinutes : 0),
        0
      ),
    [tasks]
  );
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId && task.status === 'pending') ??
    tasks.find((task) => task.status === 'pending') ??
    null;
  const activeTask = activeSession
    ? tasks.find((task) => task.id === activeSession.taskId) ?? null
    : null;

  const handleCreateTask = async (input: CreateTaskInput): Promise<CreateTaskResult> => {
    const result = await createTask(input);
    if (result.ok) setActivePanel('tasks');
    return result;
  };

  return (
    <SafeAreaView style={[styles.safeArea, colorScheme === 'dark' && styles.safeAreaDark]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {activeSession && activeTask ? (
        <ActiveSessionScreen
          session={activeSession}
          task={activeTask}
          onComplete={(completedAmount) => finishSession('completed', completedAmount)}
          onExit={(reason) => finishSession('exited', undefined, reason)}
          onFinishRest={finishRest}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerClassName="gap-5 pb-8 pt-4"
          contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: width < 360 ? 12 : 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Header />
          <AccountCard />
          {isHydrating ? <Card accessibilityRole="progressbar"><Card.Body className="items-center gap-2"><ActivityIndicator /><Text type="body-sm">正在恢复本地任务与专注状态…</Text></Card.Body></Card> : null}
          <DashboardSummary
            todayMinutes={todayMinutes}
            completedSessions={sessionRecords.filter((record) => record.outcome === 'completed').length}
          />
          <SyncStatusCard configured={syncConfigured} pending={syncPending} conflicts={syncConflicts}
            isSyncing={isSyncing} error={syncError} onSync={() => void syncNow()}
            onResolve={(id, strategy) => void resolveSyncConflict(id, strategy)} />
          <NotificationSettingsCard permission={notificationPermission} taskRemindersEnabled={taskRemindersEnabled}
            error={notificationError} onEnable={() => void enableNotifications()} onTest={() => void sendTestReminder()}
            onToggle={(enabled) => void setTaskRemindersEnabled(enabled)} />
          <ForcedTriggerStatusCard capabilities={lockCapabilities} enabledRules={habits.filter((habit) => habit.forceEnabled).length}
            onRefresh={() => void refreshLockCapabilities()} onOpen={(kind) => void openLockPermission(kind)} />
          {error || habitError ? (
            <Card variant="secondary" accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Card.Body className="gap-2">
                <Chip size="sm" color="danger" variant="soft">
                  操作失败
                </Chip>
                <Text type="body-sm">{error ?? habitError}</Text>
                <Text type="body-xs" color="muted" onPress={() => { clearError(); clearHabitError(); }}>
                  点击关闭
                </Text>
              </Card.Body>
            </Card>
          ) : null}
          <PanelTabs activePanel={activePanel} onPanelChange={setActivePanel} />
          {activePanel === 'tasks' ? (
            <TasksPanel
              tasks={tasks}
              onCreateTask={handleCreateTask}
              onStart={(taskId, mode) => void startSession(taskId, mode)}
              onGoalProgress={addGoalProgress}
            />
          ) : null}
          {activePanel === 'focus' ? (
            <FocusPanel
              selectedMode={selectedMode}
              strictOptions={strictOptions}
              selectedTask={selectedTask}
              onModeChange={selectMode}
              onStrictOptionToggle={toggleStrictOption}
              lockCapabilities={lockCapabilities}
              onRefreshLockCapabilities={() => void refreshLockCapabilities()}
              onConfirmLockRisk={() => void confirmLockRisk()}
              onOpenLockPermission={(kind) => void openLockPermission(kind)}
              onStart={() => {
                if (selectedTask) {
                  void startSession(selectedTask.id, selectedMode);
                }
              }}
            />
          ) : null}
          {activePanel === 'habits' ? <HabitsPanel habits={habits} onCreate={createHabit} onProgress={addHabitProgress} onArchive={archiveHabit} /> : null}
          {activePanel === 'statistics' ? <StatisticsPanel records={sessionRecords} /> : null}
          {activePanel === 'social' ? <SocialPanel /> : null}
          {activePanel === 'family' ? <FamilyPanel /> : null}
          {activePanel === 'vip' ? <SubscriptionPanel /> : null}
          {activePanel === 'rewards' ? <RewardPanel /> : null}
          {activePanel === 'settings' ? <SettingsPanel /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  safeAreaDark: {
    backgroundColor: '#111111',
  },
  scrollView: {
    flex: 1,
  },
});
