import { Redirect, Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { useAuthStore } from '@/modules/auth/auth.store';
import { LoadingScreen } from '@/screens/LoadingScreen';

export default function TabsLayout() {
  const status = useAuthStore((state) => state.status);
  const dark = useColorScheme() === 'dark';
  if (status === 'hydrating') return <LoadingScreen label="正在准备 LoopTodo…" />;
  if (status !== 'signed_in') return <Redirect href="/login" />;
  return <Tabs initialRouteName="today" screenOptions={{ headerShown: false, tabBarActiveTintColor: dark ? '#93C5FD' : '#2563EB', tabBarInactiveTintColor: dark ? '#A7ABB4' : '#737373', tabBarLabelStyle: { fontSize: 13, fontWeight: '600' }, tabBarStyle: { minHeight: 62, paddingTop: 6, paddingBottom: 8, backgroundColor: dark ? '#1B1D22' : '#FFFFFF', borderTopColor: dark ? '#383B42' : '#E5E5E5' } }}><Tabs.Screen name="today" options={{ title: '今日' }} /><Tabs.Screen name="focus" options={{ title: '专注' }} /><Tabs.Screen name="data" options={{ title: '数据' }} /><Tabs.Screen name="me" options={{ title: '我的' }} /></Tabs>;
}
