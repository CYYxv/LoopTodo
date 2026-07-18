import { createContext, type PropsWithChildren, useContext } from 'react';
import { Pressable, Text, View } from 'react-native';

type TabsContextValue = { value: string; onValueChange(value: string): void };

const TabsContext = createContext<TabsContextValue>({ value: '', onValueChange: () => undefined });

function Tabs({ children, value, onValueChange, accessibilityLabel }: PropsWithChildren<{ value: string; onValueChange(value: string): void; accessibilityLabel?: string }>) {
  return <TabsContext.Provider value={{ value, onValueChange }}><View accessibilityLabel={accessibilityLabel}>{children}</View></TabsContext.Provider>;
}

Tabs.List = View;
Tabs.Indicator = View;
Tabs.Trigger = function TabsTrigger({ children, value, accessibilityLabel }: PropsWithChildren<{ value: string; accessibilityLabel?: string }>) {
  const tabs = useContext(TabsContext);
  return <Pressable accessibilityRole="tab" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected: tabs.value === value }} onPress={() => tabs.onValueChange(value)}>{children}</Pressable>;
};
Tabs.Label = Text;
Tabs.Content = View;
Tabs.ScrollView = View;
Tabs.Separator = View;

function Surface({ children, accessibilityLabel }: PropsWithChildren<{ accessibilityLabel?: string }>) {
  return <View accessibilityLabel={accessibilityLabel}>{children}</View>;
}

function Skeleton({ children, isLoading = true, accessibilityLabel }: PropsWithChildren<{ isLoading?: boolean; accessibilityLabel?: string }>) {
  return <View accessibilityLabel={accessibilityLabel} accessibilityState={{ busy: isLoading }}>{children}</View>;
}

function Avatar({ children }: PropsWithChildren) {
  return <View>{children}</View>;
}

Avatar.Image = View;
Avatar.Fallback = Text;

function ListGroup({ children, accessibilityLabel }: PropsWithChildren<{ accessibilityLabel?: string }>) {
  return <View accessibilityLabel={accessibilityLabel}>{children}</View>;
}

ListGroup.Item = View;
ListGroup.ItemPrefix = View;
ListGroup.ItemContent = View;
ListGroup.ItemTitle = Text;
ListGroup.ItemDescription = Text;
ListGroup.ItemSuffix = View;

export const tabsModule = { __esModule: true, Tabs, default: Tabs };
export const surfaceModule = { __esModule: true, Surface, default: Surface };
export const skeletonModule = { __esModule: true, Skeleton, default: Skeleton };
export const avatarModule = { __esModule: true, Avatar, default: Avatar };
export const listGroupModule = { __esModule: true, ListGroup, default: ListGroup };
