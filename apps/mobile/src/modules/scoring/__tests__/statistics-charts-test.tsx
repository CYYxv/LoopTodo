import { render } from '@testing-library/react-native';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const component = ({ children, ...props }: { children?: React.ReactNode }) => React.createElement(View, props, children);
  const textComponent = ({ children, ...props }: { children?: React.ReactNode }) => React.createElement(Text, props, children);
  return { __esModule: true, default: component, Circle: component, Line: component, Polyline: component, Rect: component, Text: textComponent };
});

jest.mock('heroui-native/surface', () => require('../../../../test/statistics-heroui.mock').surfaceModule);

import { DistributionDonut, TrendChart, type StatisticsChartColors } from '../components/StatisticsCharts';

const colors: StatisticsChartColors = {
  accent: 'chart-accent',
  accentSoft: 'chart-accent-soft',
  background: 'chart-background',
  grid: 'chart-grid',
  text: 'chart-text',
  textMuted: 'chart-text-muted',
  warning: 'chart-warning',
  series: ['series-one', 'series-two'],
};

test('renders trend chart with injected semantic colors', async () => {
  const screen = await render(<TrendChart items={[{ key: 'one', label: '1 时', startAt: 0, endAt: 1, seconds: 60, sessions: 1 }]} colors={colors} />);

  expect(screen.getByTestId('trend-grid-0').props.stroke).toBe(colors.grid);
  expect(screen.getByTestId('trend-line').props.stroke).toBe(colors.accent);
  expect(screen.getByTestId('trend-point-0').props.fill).toBe(colors.accent);
});

test('uses semantic series colors instead of distribution data colors', async () => {
  const screen = await render(<DistributionDonut title="任务分布" items={[{ key: 'one', label: '阅读', color: '#000000', seconds: 60, sessions: 1 }]} colors={colors} />);

  expect(screen.getByTestId('distribution-segment-0').props.stroke).toBe(colors.series[0]);
});
