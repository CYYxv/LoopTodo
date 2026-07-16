import { tabBarMetrics } from '../../ui/tab-bar-metrics';

test('adds the bottom safe area to the tab bar base size', () => {
  expect(tabBarMetrics(24)).toEqual({ minHeight: 90, paddingBottom: 31 });
});
