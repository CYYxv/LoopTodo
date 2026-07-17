import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View, type ColorValue } from 'react-native';

import { useAuthStore } from '@/modules/auth/auth.store';
import { ActiveSessionBar } from '@/modules/focus-session/components/ActiveSessionBar';
import { useSettingsStore } from '@/modules/settings/settings.store';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { tabBarMetrics } from '@/ui/tab-bar-metrics';
import { TabIcon, type TabIconName } from '@/ui/tab-icon';
import { buildTabBarItems, normalizeBottomTabs, tabLabels, type BusinessTabKey, type TabBarKey } from '@/ui/tab-navigation';

export default function TabsLayout() {
  const status = useAuthStore((state) => state.status);
  const configured = useSettingsStore((state) => state.configured);
  const loadSettings = useSettingsStore((state) => state.load);
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    if (status === 'signed_in' && configured) void loadSettings();
  }, [configured, loadSettings, status]);

  if (status === 'hydrating') return <LoadingScreen label="正在准备 LoopTodo…" />;
  if (status !== 'signed_in') return <Redirect href="/login" />;
  const icon = (name: TabIconName) => ({ color }: { color: ColorValue }) => <TabIcon name={name} color={color} />;

  return (
    <Tabs
      initialRouteName="tasks"
      tabBar={(props) => <LoopTodoTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: dark ? '#93C5FD' : '#2563EB',
        tabBarInactiveTintColor: dark ? '#A7ABB4' : '#737373',
      }}
    >
      <Tabs.Screen name="tasks" options={{ title: '任务', tabBarIcon: icon('tasks') }} />
      <Tabs.Screen name="habits" options={{ title: '习惯', tabBarIcon: icon('habits') }} />
      <Tabs.Screen name="statistics" options={{ title: '统计', tabBarIcon: icon('statistics') }} />
      <Tabs.Screen name="social" options={{ title: '社交', tabBarIcon: icon('social') }} />
      <Tabs.Screen name="me" options={{ title: '我的', tabBarIcon: icon('me') }} />
    </Tabs>
  );
}

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function LoopTodoTabBar({ state, navigation, insets }: TabBarProps) {
  const dark = useColorScheme() === 'dark';
  const configuredTabs = useSettingsStore((settings) => settings.value?.bottomTabs);
  const [moreOpen, setMoreOpen] = useState(false);
  const items = buildTabBarItems(normalizeBottomTabs(configuredTabs));
  const bottomItems = items.filter((item) => item.location === 'bottom');
  const moreItems = items.filter((item): item is { key: BusinessTabKey; location: 'more' } => item.location === 'more');
  const activeRoute = state.routes[state.index]?.name as BusinessTabKey | undefined;
  const moreFocused = moreItems.some((item) => item.key === activeRoute);

  const navigate = (key: BusinessTabKey) => {
    const route = state.routes.find((item) => item.name === key);
    if (!route) return;
    const focused = route.name === activeRoute;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    setMoreOpen(false);
  };

  return (
    <View>
      <ActiveSessionBar />
      {moreOpen ? (
        <View style={[styles.moreRow, dark && styles.moreRowDark]}>
          {moreItems.map((item) => {
            const color = item.key === activeRoute ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#D4D4D8' : '#525252');
            return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={tabLabels[item.key]} onPress={() => navigate(item.key)} style={styles.moreItem}><TabIcon name={item.key} color={color} /><Text style={[styles.moreLabel, { color }]}>{tabLabels[item.key]}</Text></Pressable>;
          })}
        </View>
      ) : null}
      <View style={[styles.tabBar, tabBarMetrics(insets.bottom), dark && styles.tabBarDark]}>
        {bottomItems.map(({ key }) => {
          const focused = key === 'more' ? moreFocused || moreOpen : key === activeRoute;
          const color = focused ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#A7ABB4' : '#737373');
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tabLabels[key]}
              onPress={() => key === 'more' ? setMoreOpen((open) => !open) : navigate(key)}
              style={styles.tabItem}
            >
              <TabIcon name={key as TabIconName} color={color} />
              <Text maxFontSizeMultiplier={2} style={[styles.tabLabel, { color }]}>{tabLabels[key]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moreRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F5F7FB', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  moreRowDark: { backgroundColor: '#24262C', borderTopColor: '#3F424A' },
  moreItem: { minWidth: 92, minHeight: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 },
  moreLabel: { fontSize: 14, fontWeight: '600' },
  tabBar: { minHeight: 66, flexDirection: 'row', paddingTop: 5, paddingBottom: 7, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5' },
  tabBarDark: { backgroundColor: '#1B1D22', borderTopColor: '#383B42' },
  tabItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
});
