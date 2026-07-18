import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { PressableFeedback } from 'heroui-native/pressable-feedback';

import { useAuthStore } from '@/modules/auth/auth.store';
import { ActiveSessionBar } from '@/modules/focus-session/components/ActiveSessionBar';
import { useSettingsStore } from '@/modules/settings/settings.store';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { tabBarMetrics } from '@/ui/tab-bar-metrics';
import { TabIcon, type TabIconName } from '@/ui/tab-icon';
import { buildTabBarItems, normalizeBottomTabs, tabLabels, type BusinessTabKey, type TabBarKey } from '@/ui/tab-navigation';
import { useLoopTodoTheme } from '@/ui/theme';

export default function TabsLayout() {
  const status = useAuthStore((state) => state.status);
  const configured = useSettingsStore((state) => state.configured);
  const loadSettings = useSettingsStore((state) => state.load);
  const { colors } = useLoopTodoTheme();

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
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
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
  const { colors } = useLoopTodoTheme();
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
        <View style={[styles.moreRow, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.separator }]}>
          {moreItems.map((item) => {
            const color = item.key === activeRoute ? colors.accent : colors.textMuted;
            return <PressableFeedback key={item.key} accessibilityRole="tab" accessibilityLabel={tabLabels[item.key]} onPress={() => navigate(item.key)} style={styles.moreItem} animation={{ scale: { value: 0.985, timingConfig: { duration: 180 } } }}><TabIcon name={item.key} color={color} /><Text style={[styles.moreLabel, { color }]}>{tabLabels[item.key]}</Text><PressableFeedback.Ripple /></PressableFeedback>;
          })}
        </View>
      ) : null}
      <View style={[styles.tabBar, tabBarMetrics(insets.bottom), { backgroundColor: colors.surface, borderTopColor: colors.separator }]}>
        {bottomItems.map(({ key }) => {
          const focused = key === 'more' ? moreFocused || moreOpen : key === activeRoute;
          const color = focused ? colors.accent : colors.textMuted;
          return (
            <PressableFeedback
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tabLabels[key]}
              onPress={() => key === 'more' ? setMoreOpen((open) => !open) : navigate(key)}
              style={styles.tabItem}
              animation={{ scale: { value: 0.985, timingConfig: { duration: 180 } } }}
            >
              <TabIcon name={key as TabIconName} color={color} />
              <Text maxFontSizeMultiplier={2} style={[styles.tabLabel, { color }]}>{tabLabels[key]}</Text>
              <PressableFeedback.Ripple />
            </PressableFeedback>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moreRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  moreItem: { minWidth: 92, minHeight: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, overflow: 'hidden' },
  moreLabel: { fontSize: 14, fontWeight: '600' },
  tabBar: { minHeight: 66, flexDirection: 'row', paddingTop: 5, paddingBottom: 7, borderTopWidth: StyleSheet.hairlineWidth },
  tabItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  tabLabel: { fontSize: 12, fontWeight: '600' },
});
