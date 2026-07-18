import { useWindowDimensions, View } from 'react-native';
import { Surface } from 'heroui-native/surface';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/ui/hero-runtime';
import { useLoopTodoTheme } from '@/ui/theme';

import type {
  StatisticsBucket,
  StatisticsDistributionItem,
  StatisticsHeatmapDay,
  StatisticsHourBucket,
  StatisticsWeekTimelineDay,
} from '../scoring.types';

export type StatisticsChartColors = {
  accent: string;
  accentSoft: string;
  background: string;
  grid: string;
  text: string;
  textMuted: string;
  warning: string;
  series: string[];
};

type ChartColorsProp = { colors?: StatisticsChartColors };

export function TrendChart({ items, colors: injectedColors }: { items: StatisticsBucket[] } & ChartColorsProp) {
  const colors = useStatisticsChartColors(injectedColors);
  const maxSeconds = Math.max(0, ...items.map((item) => item.seconds));
  const chartItems = sampleItems(items, 96);
  const points = chartItems.map((item, index) => {
    const x = chartItems.length === 1 ? 160 : 16 + index / (chartItems.length - 1) * 288;
    const y = 116 - (maxSeconds ? item.seconds / maxSeconds * 88 : 0);
    return { x, y };
  });

  return <ChartCard title="专注趋势" description="范围内专注时长随时间变化">
    {maxSeconds ? <>
      <Svg width="100%" height={140} viewBox="0 0 320 140" accessibilityLabel="专注趋势折线图">
        {[28, 72, 116].map((y, index) => <Line testID={`trend-grid-${index}`} key={y} x1={16} x2={304} y1={y} y2={y} stroke={colors.grid} strokeWidth={1} />)}
        <Polyline testID="trend-line" points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 32 ? points.map((point, index) => <Circle testID={`trend-point-${index}`} key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={3} fill={colors.accent} stroke={colors.background} strokeWidth={1.5} />) : null}
      </Svg>
      <AxisLabels items={items} />
    </> : <EmptyChart />}
  </ChartCard>;
}

export function DistributionDonut({ title, items, colors: injectedColors }: { title: string; items: StatisticsDistributionItem[] } & ChartColorsProp) {
  const colors = useStatisticsChartColors(injectedColors);
  const total = items.reduce((sum, item) => sum + item.seconds, 0);
  const radius = 42;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;

  return <ChartCard title={title} description="按实际专注时长计算">
    {total ? <View className="flex-row flex-wrap items-center gap-4">
      <Svg width={124} height={124} viewBox="0 0 124 124" accessibilityLabel={`${title}圆环图`}>
        <Circle cx={62} cy={62} r={radius} fill="none" stroke={colors.grid} strokeWidth={18} />
        {items.map((item, index) => {
          const length = item.seconds / total * circumference;
          const dashOffset = -offset;
          offset += length;
          return <Circle testID={`distribution-segment-${index}`} key={item.key} cx={62} cy={62} r={radius} fill="none" stroke={seriesColor(colors, index)} strokeWidth={18} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashOffset} rotation={-90} origin="62,62" />;
        })}
        <SvgText x={62} y={59} textAnchor="middle" fontSize={13} fontWeight="600" fill={colors.text}>{formatCompactDuration(total)}</SvgText>
        <SvgText x={62} y={76} textAnchor="middle" fontSize={10} fill={colors.textMuted}>{items.reduce((sum, item) => sum + item.sessions, 0)} 次</SvgText>
      </Svg>
      <View className="min-w-40 flex-1 gap-2">
        {items.slice(0, 6).map((item, index) => <View key={item.key} className="flex-row items-center justify-between gap-2">
          <View className="flex-row min-w-0 flex-1 items-center gap-2"><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: seriesColor(colors, index) }} /><Text type="body-xs" numberOfLines={1}>{item.label}</Text></View>
          <Text type="body-xs" color="muted">{Math.round(item.seconds / total * 100)}%</Text>
        </View>)}
        {items.length > 6 ? <Text type="body-xs" color="muted">另有 {items.length - 6} 项</Text> : null}
      </View>
    </View> : <EmptyChart />}
  </ChartCard>;
}

export function WeekTimelineChart({ days, colors: injectedColors }: { days: StatisticsWeekTimelineDay[] } & ChartColorsProp) {
  const colors = useStatisticsChartColors(injectedColors);
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const slots = compact ? 12 : 24;
  const grouped = days.map((day) => ({ ...day, values: groupHours(day.hours, slots) }));
  const maxSeconds = Math.max(0, ...grouped.flatMap((day) => day.values.map((item) => item.seconds)));

  return <ChartCard title="每周时间线" description={compact ? '每格代表 2 小时' : '每格代表 1 小时'}>
    {maxSeconds ? <View className="gap-2">
      {grouped.map((day) => <View key={day.day} className="flex-row items-center gap-2">
        <Text type="body-xs" color="muted" style={{ width: 22 }}>{day.label.slice(1)}</Text>
        <View className="flex-1 flex-row gap-1">
          {day.values.map((item, index) => <View key={index} accessibilityLabel={`${day.label}${item.hour}时 ${formatCompactDuration(item.seconds)}`} className="flex-1 rounded-sm" style={{ height: 13, backgroundColor: item.seconds ? colors.accent : colors.grid, opacity: item.seconds ? 0.28 + item.seconds / maxSeconds * 0.72 : 1 }} />)}
        </View>
      </View>)}
      <View className="ml-8 flex-row justify-between"><Text type="body-xs" color="muted">0 时</Text><Text type="body-xs" color="muted">12 时</Text><Text type="body-xs" color="muted">24 时</Text></View>
    </View> : <EmptyChart />}
  </ChartCard>;
}

export function StartTimeChart({ hours, bestHour, colors: injectedColors }: { hours: StatisticsHourBucket[]; bestHour: number | null } & ChartColorsProp) {
  const colors = useStatisticsChartColors(injectedColors);
  const maxSeconds = Math.max(0, ...hours.map((item) => item.seconds));
  return <ChartCard title="最佳开始时段" description={bestHour == null ? '完成几次专注后即可识别' : `${bestHour}:00 - ${bestHour + 1}:00 的累计专注最多`}>
    {maxSeconds ? <>
      <Svg width="100%" height={132} viewBox="0 0 320 132" accessibilityLabel="最佳开始时段柱图">
        <Line x1={12} x2={308} y1={104} y2={104} stroke={colors.grid} strokeWidth={1} />
        {hours.map((item) => {
          const barHeight = item.seconds / maxSeconds * 82;
          const x = 14 + item.hour * 12.2;
          return <Rect key={item.hour} x={x} y={104 - barHeight} width={7.5} height={Math.max(2, barHeight)} rx={2} fill={item.hour === bestHour ? colors.warning : colors.accent} opacity={item.seconds ? 1 : 0.18} />;
        })}
        {[0, 6, 12, 18, 23].map((hour) => <SvgText key={hour} x={18 + hour * 12.2} y={124} textAnchor="middle" fontSize={9} fill={colors.textMuted}>{hour}</SvgText>)}
      </Svg>
    </> : <EmptyChart />}
  </ChartCard>;
}

export function YearHeatmap({ year, days, colors: injectedColors }: { year: number; days: StatisticsHeatmapDay[] } & ChartColorsProp) {
  const colors = useStatisticsChartColors(injectedColors);
  const maxSeconds = Math.max(0, ...days.map((item) => item.seconds));
  return <ChartCard title="年度专注热力图" description={`${year} 年每日专注强度`}>
    {maxSeconds ? <>
      <Svg width="100%" height={62} viewBox="0 0 326 62" accessibilityLabel={`${year}年度专注热力图`}>
        {days.map((item) => <Rect key={item.date} x={item.week * 6 + 4} y={item.weekday * 8 + 3} width={5} height={6} rx={1} fill={item.seconds ? colors.accent : colors.grid} opacity={item.seconds ? 0.24 + item.seconds / maxSeconds * 0.76 : 1} />)}
      </Svg>
      <View className="flex-row items-center justify-end gap-1"><Text type="body-xs" color="muted">少</Text>{[0.18, 0.4, 0.62, 0.84, 1].map((opacity) => <View key={opacity} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.accent, opacity }} />)}<Text type="body-xs" color="muted">多</Text></View>
    </> : <EmptyChart />}
  </ChartCard>;
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Surface variant="secondary" className="gap-3 rounded-panel p-4"><View><Text type="body-lg" weight="semibold">{title}</Text><Text type="body-sm" color="muted">{description}</Text></View>{children}</Surface>;
}

function useStatisticsChartColors(injectedColors?: StatisticsChartColors): StatisticsChartColors {
  const { colors } = useLoopTodoTheme();
  return injectedColors ?? {
    accent: colors.accent,
    accentSoft: colors.accentSoft,
    background: colors.surface,
    grid: colors.chartGrid,
    text: colors.text,
    textMuted: colors.textMuted,
    warning: colors.warning,
    series: [colors.accent, colors.success, colors.warning, colors.danger, colors.textMuted],
  };
}

function seriesColor(colors: StatisticsChartColors, index: number) {
  return colors.series[index % colors.series.length] ?? colors.accent;
}

function EmptyChart() {
  return <View className="items-center py-5"><Text type="body-sm" color="muted">暂无数据</Text></View>;
}

function AxisLabels({ items }: { items: StatisticsBucket[] }) {
  const labels = items.length <= 1 ? items : [items[0], items[Math.floor((items.length - 1) / 2)], items[items.length - 1]];
  return <View className="flex-row justify-between">{labels.map((item, index) => <Text key={`${item.key}-${index}`} type="body-xs" color="muted">{item.label}</Text>)}</View>;
}

function sampleItems<T>(items: T[], maximum: number) {
  if (items.length <= maximum) return items;
  const sampled: T[] = [];
  for (let index = 0; index < maximum; index += 1) sampled.push(items[Math.round(index / (maximum - 1) * (items.length - 1))]);
  return sampled;
}

function groupHours(hours: StatisticsHourBucket[], slots: number) {
  const size = 24 / slots;
  return Array.from({ length: slots }, (_, slot) => {
    const start = slot * size;
    let seconds = 0;
    let sessions = 0;
    for (let index = start; index < start + size; index += 1) {
      seconds += hours[index].seconds;
      sessions += hours[index].sessions;
    }
    return { hour: start, seconds, sessions };
  });
}

function formatCompactDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}时${remainder}分` : `${hours}小时`;
}
