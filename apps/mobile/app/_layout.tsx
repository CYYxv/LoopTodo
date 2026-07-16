import '../global.css';

import { Redirect, Stack, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppProviders } from '@/providers/AppProviders';
import { AppBootstrap } from '@/providers/AppBootstrap';
import { useAuthStore } from '@/modules/auth/auth.store';
import { LoadingScreen } from '@/screens/LoadingScreen';

export default function RootLayout() {
  return (
    <AppProviders>
      <AppBootstrap>
        <RootNavigator />
      </AppBootstrap>
    </AppProviders>
  );
}

function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const segments = useSegments();
  if (status === 'hydrating') return <LoadingScreen label="正在恢复 LoopTodo…" />;
  if (status === 'signed_out' && segments[0] !== 'login') return <Redirect href="/login" />;
  if (status === 'signed_in' && segments[0] === 'login') return <Redirect href="/tasks" />;
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="login" /><Stack.Screen name="create-task" options={{ presentation: 'modal' }} /><Stack.Screen name="session" options={{ gestureEnabled: false }} /><Stack.Screen name="habit/[id]" /></Stack>;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  console.error('LoopTodo route render failed', error);
  return (
    <View style={styles.errorPage}>
      <Text style={styles.errorTitle}>LoopTodo 暂时无法显示此页面</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Text accessibilityRole="button" onPress={retry} style={styles.retry}>重新加载</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorPage: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FAFAFA', gap: 12 },
  errorTitle: { color: '#171717', fontSize: 22, fontWeight: '700' },
  errorMessage: { color: '#666666', fontSize: 14, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 12, backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: 16, fontWeight: '600', paddingHorizontal: 18, paddingVertical: 12 },
});
