import '../global.css';

import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppProviders } from '@/providers/AppProviders';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
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
