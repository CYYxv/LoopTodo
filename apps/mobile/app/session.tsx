import { Redirect, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ActiveSessionScreen } from '@/modules/focus-session/components/ActiveSessionScreen';
import { taskStore, useTaskStore } from '@/modules/tasks/task.store';

export default function SessionRoute() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const session = useTaskStore((state) => state.activeSession);
  const tasks = useTaskStore((state) => state.tasks);
  const finishSession = useTaskStore((state) => state.finishSession);
  const finishRest = useTaskStore((state) => state.finishRest);
  const toggleSessionPause = useTaskStore((state) => state.toggleSessionPause);
  const isPausePending = useTaskStore((state) => state.isTogglingPause);
  const error = useTaskStore((state) => state.error);
  if (!session) return <Redirect href="/tasks" />;
  const task = tasks.find((candidate) => candidate.id === session.taskId);
  if (!task) return <Redirect href="/tasks" />;
  const complete = async (amount?: number) => { await finishSession('completed', amount); if (!taskStore.getState().activeSession) router.replace('/tasks'); };
  const exit = async (reason?: string) => { await finishSession('exited', undefined, reason); if (!taskStore.getState().activeSession) router.replace('/tasks'); };
  const endRest = async () => { await finishRest(); router.replace('/tasks'); };
  return <SafeAreaView style={{ flex: 1, backgroundColor: dark ? '#101114' : '#F7F8FA' }}><StatusBar style={dark ? 'light' : 'dark'} /><ActiveSessionScreen session={session} task={task} error={error} isPausePending={isPausePending} onTogglePause={toggleSessionPause} onComplete={complete} onExit={exit} onFinishRest={endRest} /></SafeAreaView>;
}
