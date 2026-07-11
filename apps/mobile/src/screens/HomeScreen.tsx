import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Text } from 'heroui-native/text';

import { ActiveSessionScreen } from '@/modules/focus-session/components/ActiveSessionScreen';
import { HabitsPanel } from '@/modules/habits/components/HabitsPanel';
import { useHabitStore } from '@/modules/habits/habit.store';
import { FocusPanel } from '@/modules/focus-session/components/FocusPanel';
import { FamilyPanel, SocialPanel } from '@/modules/social/components/SocialPanels';
import { TasksPanel } from '@/modules/tasks/components/TasksPanel';
import { useTaskStore } from '@/modules/tasks/task.store';
import type { CreateTaskInput } from '@/modules/tasks/task.types';
import {
  DashboardSummary,
  Header,
  PanelTabs,
  type PanelKey,
} from '@/screens/components/DashboardChrome';

export function HomeScreen() {
  const [activePanel, setActivePanel] = useState<PanelKey>('tasks');
  const tasks = useTaskStore((state) => state.tasks);
  const activeSession = useTaskStore((state) => state.activeSession);
  const sessionRecords = useTaskStore((state) => state.sessionRecords);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectedMode = useTaskStore((state) => state.selectedMode);
  const strictOptions = useTaskStore((state) => state.strictOptions);
  const error = useTaskStore((state) => state.error);
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

  useEffect(() => {
    void hydrate();
    void hydrateHabits();
  }, [hydrate, hydrateHabits]);

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

  const handleCreateTask = async (input: CreateTaskInput) => {
    await createTask(input);
    setActivePanel('tasks');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      {activeSession && activeTask ? (
        <ActiveSessionScreen
          session={activeSession}
          task={activeTask}
          onComplete={(completedAmount) => finishSession('completed', completedAmount)}
          onExit={() => finishSession('exited')}
          onFinishRest={finishRest}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 px-5 pb-8 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <Header />
          <DashboardSummary
            todayMinutes={todayMinutes}
            completedSessions={sessionRecords.filter((record) => record.outcome === 'completed').length}
          />
          {error || habitError ? (
            <Card variant="secondary">
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
              onStart={() => {
                if (selectedTask) {
                  void startSession(selectedTask.id, selectedMode);
                }
              }}
            />
          ) : null}
          {activePanel === 'habits' ? <HabitsPanel habits={habits} onCreate={createHabit} onProgress={addHabitProgress} onArchive={archiveHabit} /> : null}
          {activePanel === 'social' ? <SocialPanel /> : null}
          {activePanel === 'family' ? <FamilyPanel /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
