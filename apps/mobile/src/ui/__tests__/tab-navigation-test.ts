type OptionalTab = 'habits' | 'statistics' | 'social';
type NavigationModule = {
  defaultBottomTabs: readonly OptionalTab[];
  normalizeBottomTabs(value: unknown): [OptionalTab, OptionalTab];
  buildTabBarItems(value: unknown): Array<{ key: 'tasks' | OptionalTab | 'me' | 'more'; location: 'bottom' | 'more' }>;
};

function navigation(): NavigationModule {
  return require('../tab-navigation') as NavigationModule;
}

test('uses habits and statistics as the default configurable tabs', () => {
  expect(navigation().normalizeBottomTabs(undefined)).toEqual(['habits', 'statistics']);
});

test('rejects duplicate or unknown cached tab values', () => {
  expect(navigation().normalizeBottomTabs(['social', 'social'])).toEqual(['habits', 'statistics']);
  expect(navigation().normalizeBottomTabs(['social', 'focus'])).toEqual(['habits', 'statistics']);
});

test('keeps tasks, me and more fixed while placing one feature in more', () => {
  expect(navigation().buildTabBarItems(['social', 'habits'])).toEqual([
    { key: 'tasks', location: 'bottom' },
    { key: 'social', location: 'bottom' },
    { key: 'habits', location: 'bottom' },
    { key: 'me', location: 'bottom' },
    { key: 'more', location: 'bottom' },
    { key: 'statistics', location: 'more' },
  ]);
});
