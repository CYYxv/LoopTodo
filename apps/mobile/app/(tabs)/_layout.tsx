import { Redirect, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { ColorValue } from 'react-native';
import type { ComponentProps } from 'react';

import { useAuthStore } from '@/modules/auth/auth.store';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { TabIcon, type TabIconName } from '@/ui/tab-icon';
import { tabBarMetrics } from '@/ui/tab-bar-metrics';
import { ActiveSessionBar } from '@/modules/focus-session/components/ActiveSessionBar';

export default function TabsLayout() {
  const status = useAuthStore((state) => state.status);
  const dark = useColorScheme() === 'dark';
  if (status === 'hydrating') return <LoadingScreen label="正在准备 LoopTodo…" />;
  if (status !== 'signed_in') return <Redirect href="/login" />;
  const icon = (name: TabIconName) => ({ color }: { color: ColorValue }) => <TabIcon name={name} color={color} />;
  return <Tabs initialRouteName="tasks" tabBar={(props) => <LoopTodoTabBar {...props} />} screenOptions={{ headerShown: false, tabBarActiveTintColor: dark ? '#93C5FD' : '#2563EB', tabBarInactiveTintColor: dark ? '#A7ABB4' : '#737373', tabBarLabelStyle: { fontSize: 13, fontWeight: '600' }, tabBarItemStyle: { paddingVertical: 3 }, tabBarStyle: { minHeight: 66, paddingTop: 5, paddingBottom: 7, backgroundColor: dark ? '#1B1D22' : '#FFFFFF', borderTopColor: dark ? '#383B42' : '#E5E5E5' } }}><Tabs.Screen name="tasks" options={{ title: '任务', tabBarIcon: icon('tasks') }} /><Tabs.Screen name="habits" options={{ title: '习惯', tabBarIcon: icon('habits') }} /><Tabs.Screen name="statistics" options={{ title: '统计', tabBarIcon: icon('statistics') }} /><Tabs.Screen name="me" options={{ title: '我的', tabBarIcon: icon('me') }} /></Tabs>;
}

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function LoopTodoTabBar({ state, navigation, insets }: TabBarProps) {
  const dark = useColorScheme() === 'dark';
  return <View><ActiveSessionBar /><View style={[styles.tabBar, tabBarMetrics(insets.bottom), dark && styles.tabBarDark]}>{state.routes.map((route, index) => {
    const focused = state.index === index;
    const name = route.name as TabIconName;
    const label = { tasks: '任务', habits: '习惯', statistics: '统计', me: '我的' }[name] ?? route.name;
    const color = focused ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#A7ABB4' : '#737373');
    return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params); }} style={styles.tabItem}><TabIcon name={name} color={color} /><Text style={[styles.tabLabel, { color }]}>{label}</Text></Pressable>;
  })}</View></View>;
}

const styles = StyleSheet.create({ tabBar: { minHeight: 66, flexDirection: 'row', paddingTop: 5, paddingBottom: 7, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5' }, tabBarDark: { backgroundColor: '#1B1D22', borderTopColor: '#383B42' }, tabItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabLabel: { fontSize: 13, fontWeight: '600' } });
