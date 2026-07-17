export const optionalTabKeys = ['habits', 'statistics', 'social'] as const;
export type OptionalTabKey = typeof optionalTabKeys[number];
export type BusinessTabKey = 'tasks' | OptionalTabKey | 'me';
export type TabBarKey = BusinessTabKey | 'more';

export const defaultBottomTabs: readonly OptionalTabKey[] = ['habits', 'statistics'];

export const tabLabels: Record<TabBarKey, string> = {
  tasks: '任务',
  habits: '习惯',
  statistics: '统计',
  social: '社交',
  me: '我的',
  more: '更多',
};

export function normalizeBottomTabs(value: unknown): [OptionalTabKey, OptionalTabKey] {
  if (!Array.isArray(value) || value.length !== 2) return [defaultBottomTabs[0], defaultBottomTabs[1]];
  const tabs = value.filter((item): item is OptionalTabKey => typeof item === 'string' && optionalTabKeys.includes(item as OptionalTabKey));
  if (tabs.length !== 2 || tabs[0] === tabs[1]) return [defaultBottomTabs[0], defaultBottomTabs[1]];
  return [tabs[0], tabs[1]];
}

export function buildTabBarItems(value: unknown): Array<{ key: TabBarKey; location: 'bottom' | 'more' }> {
  const bottomTabs = normalizeBottomTabs(value);
  const moreTab = optionalTabKeys.find((key) => !bottomTabs.includes(key))!;
  return [
    { key: 'tasks', location: 'bottom' },
    ...bottomTabs.map((key) => ({ key, location: 'bottom' as const })),
    { key: 'me', location: 'bottom' },
    { key: 'more', location: 'bottom' },
    { key: moreTab, location: 'more' },
  ];
}

export function replaceBottomTab(value: unknown, next: OptionalTabKey, index = 1): [OptionalTabKey, OptionalTabKey] {
  const tabs = normalizeBottomTabs(value);
  const currentIndex = tabs.indexOf(next);
  if (currentIndex >= 0) {
    if (currentIndex === index) return tabs;
    return [tabs[1], tabs[0]];
  }
  const target = index === 0 ? 0 : 1;
  return target === 0 ? [next, tabs[1]] : [tabs[0], next];
}
