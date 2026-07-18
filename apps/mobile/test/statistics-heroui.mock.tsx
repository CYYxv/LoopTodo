import { createContext, type PropsWithChildren, useContext } from 'react';
import { Pressable, Text, View } from 'react-native';

type TabsContextValue = { value: string; onValueChange(value: string): void };

const TabsContext = createContext<TabsContextValue>({ value: '', onValueChange: () => undefined });

function Tabs({ children, value, onValueChange, accessibilityLabel }: PropsWithChildren<{ value: string; onValueChange(value: string): void; accessibilityLabel?: string }>) {
  return <TabsContext.Provider value={{ value, onValueChange }}><View accessibilityLabel={accessibilityLabel}>{children}</View></TabsContext.Provider>;
}
Tabs.List = View;
Tabs.Trigger = function TabsTrigger({ children, value }: PropsWithChildren<{ value: string }>) {
  const tabs = useContext(TabsContext);
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: tabs.value === value }} onPress={() => tabs.onValueChange(value)}>{children}</Pressable>;
};
Tabs.Label = Text;
Tabs.Indicator = View;
Tabs.Content = View;
Tabs.ScrollView = View;
Tabs.Separator = View;

function Surface({ children, accessibilityLabel }: PropsWithChildren<{ accessibilityLabel?: string }>) {
  return <View accessibilityLabel={accessibilityLabel}>{children}</View>;
}

function Skeleton({ children, isLoading, accessibilityLabel }: PropsWithChildren<{ isLoading?: boolean; accessibilityLabel?: string }>) {
  return <View accessibilityLabel={accessibilityLabel} accessibilityState={{ busy: Boolean(isLoading) }}>{children}</View>;
}

export const tabsModule = { Tabs };
export const surfaceModule = { Surface };
export const skeletonModule = { Skeleton };
