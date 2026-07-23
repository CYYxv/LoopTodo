import { useCallback } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ActiveSessionScreen } from '@/modules/focus-session/components/ActiveSessionScreen';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';
import { Button, Text } from '@/ui/hero-runtime';

export default function SessionRoute() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const session = useTaskStore((state) => state.activeSession);
  const tasks = useTaskStore((state) => state.tasks);
  const finishSession = useTaskStore((state) => state.finishSession);
  const finishRest = useTaskStore((state) => state.finishRest);
  const completeExpiredCountdown = useTaskStore((state) => state.completeExpiredCountdown);
  const toggleSessionPause = useTaskStore((state) => state.toggleSessionPause);
  const isPausePending = useTaskStore((state) => state.isTogglingPause);
  const error = useTaskStore((state) => state.error);
  const lastStarDelta = useTaskStore((state) => state.lastStarDelta);
  const clearStarDelta = useCallback(() => {
    taskStore.setState({ lastStarDelta: null });
  }, []);
  const goTasks = useCallback(() => {
    clearStarDelta();
    router.replace('/tasks');
  }, [clearStarDelta, router]);
  const completeExpired = useCallback(async () => {
    const result = await completeExpiredCountdown('foreground');
    // keep route while rest or settle can show
    if (result === 'completed' && !taskStore.getState().activeSession && taskStore.getState().lastStarDelta == null) {
      router.replace('/tasks');
    }
    return result;
  }, [completeExpiredCountdown, router]);

  if (!session) {
    if (typeof lastStarDelta === 'number') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: dark ? '#101114' : '#F7F8FA' }}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <View className="flex-1 items-center justify-center gap-4 px-6" accessibilityLabel="专注星结算">
            <Text type="h3" weight="semibold">专注已结束</Text>
            <Text type="h2" weight="bold" color="accent">
              {lastStarDelta > 0 ? `本次 +${lastStarDelta} 星` : lastStarDelta < 0 ? `本次 ${lastStarDelta} 星` : '本次 +0 星'}
            </Text>
            {lastStarDelta === 0 ? (
              <Text type="body-sm" color="muted" align="center">有效专注满 25 分钟才记星；白名单模式记星最少。</Text>
            ) : (
              <Text type="body-sm" color="muted" align="center">星已按当次整星结算，不跨次保留进度。</Text>
            )}
            <Button onPress={goTasks}>返回任务</Button>
          </View>
        </SafeAreaView>
      );
    }
    return <Redirect href="/tasks" />;
  }

  const task = tasks.find((candidate) => candidate.id === session.taskId);
  if (!task) return <Redirect href="/tasks" />;

  const complete = async (amount?: number, completionNote?: string) => {
    await finishSession('completed', amount, undefined, completionNote);
    // rest phase keeps session route; settle UI handles no-session case
    if (!taskStore.getState().activeSession && taskStore.getState().lastStarDelta == null) {
      router.replace('/tasks');
    }
  };
  const exit = async (reason?: string) => {
    await finishSession('exited', undefined, reason);
    if (!taskStore.getState().activeSession && taskStore.getState().lastStarDelta == null) {
      router.replace('/tasks');
    }
  };
  const endRest = async () => {
    await finishRest();
    if (taskStore.getState().lastStarDelta == null) router.replace('/tasks');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? '#101114' : '#F7F8FA' }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ActiveSessionScreen
        session={session}
        task={task}
        error={error}
        lastStarDelta={lastStarDelta}
        isPausePending={isPausePending}
        onTogglePause={toggleSessionPause}
        onComplete={complete}
        onExit={exit}
        onFinishRest={endRest}
        onCountdownExpired={completeExpired}
      />
    </SafeAreaView>
  );
}
