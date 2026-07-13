import { Redirect, Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import type { ColorValue } from 'react-native';

import { useAuthStore } from '@/modules/auth/auth.store';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { TabIcon, type TabIconName } from '@/ui/tab-icon';

export default function TabsLayout() {
  const status = useAuthStore((state) => state.status);
  const dark = useColorScheme() === 'dark';
  if (status === 'hydrating') return <LoadingScreen label="正在准备 LoopTodo…" />;
  if (status !== 'signed_in') return <Redirect href="/login" />;
  const icon = (name: TabIconName) => ({ color }: { color: ColorValue }) => <TabIcon name={name} color={color} />;
  return <Tabs initialRouteName="today" screenOptions={{ headerShown: false, tabBarActiveTintColor: dark ? '#93C5FD' : '#2563EB', tabBarInactiveTintColor: dark ? '#A7ABB4' : '#737373', tabBarLabelStyle: { fontSize: 13, fontWeight: '600' }, tabBarItemStyle: { paddingVertical: 3 }, tabBarStyle: { minHeight: 66, paddingTop: 5, paddingBottom: 7, backgroundColor: dark ? '#1B1D22' : '#FFFFFF', borderTopColor: dark ? '#383B42' : '#E5E5E5' } }}><Tabs.Screen name="today" options={{ title: '今日', tabBarIcon: icon('today') }} /><Tabs.Screen name="focus" options={{ title: '专注', tabBarIcon: icon('focus') }} /><Tabs.Screen name="data" options={{ title: '数据', tabBarIcon: icon('data') }} /><Tabs.Screen name="me" options={{ title: '我的', tabBarIcon: icon('me') }} /></Tabs>;
}
