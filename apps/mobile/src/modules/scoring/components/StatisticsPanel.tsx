import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';
import type { Task } from '@/modules/tasks/task.types';
import { getUsageAccessStatus, openUsageAccessSettings, queryAppUsage, summarizeDeviceUsage } from '@/modules/device-usage';
import { Button, Card, Chip, Input, Text } from '@/ui/hero-runtime';
import { BottomSheetModal } from '@/ui/bottom-sheet-modal';

import { aggregateFocusStatistics, createStatisticsRange, formatStatisticsDateInput, shiftStatisticsAnchor } from '../scoring.local';
import { useScoringStore } from '../scoring.store';
import type { StatisticsRangeKind, StatisticsRecentRecord, UsageStatisticsData } from '../scoring.types';
import { DistributionDonut, StartTimeChart, TrendChart, WeekTimelineChart, YearHeatmap } from './StatisticsCharts';

type StatisticsPanelProps = {
  records: FocusSessionRecord[];
  tasks: Task[];
  usage?: UsageStatisticsData;
};

const RANGE_OPTIONS: Array<{ kind: StatisticsRangeKind; label: string }> = [
  { kind: 'day', label: '日' },
  { kind: 'week', label: '周' },
  { kind: 'month', label: '月' },
  { kind: 'year', label: '年' },
  { kind: 'custom', label: '自定义' },
];

export function StatisticsPanel({ records, tasks, usage }: StatisticsPanelProps) {
  const [anchor, setAnchor] = useState(() => Date.now());
  const defaultCustom = useMemo(() => {
    const start = new Date(anchor);
    start.setDate(start.getDate() - 29);
    return { startDate: formatStatisticsDateInput(start), endDate: formatStatisticsDateInput(anchor) };
  }, [anchor]);
  const [rangeKind, setRangeKind] = useState<StatisticsRangeKind>('day');
  const [customRange, setCustomRange] = useState(defaultCustom);
  const [draftStartDate, setDraftStartDate] = useState(defaultCustom.startDate);
  const [draftEndDate, setDraftEndDate] = useState(defaultCustom.endDate);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [usageRefresh, setUsageRefresh] = useState(0);
  const [localUsage, setLocalUsage] = useState<UsageStatisticsData>({ status: 'unavailable', reason: '正在检测使用情况访问权限' });
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const dark = useColorScheme() === 'dark';
  const range = useMemo(() => createStatisticsRange(rangeKind, anchor, customRange), [anchor, customRange, rangeKind]);
  const dashboard = useMemo(() => aggregateFocusStatistics({ records, tasks, range, now: anchor }), [anchor, range, records, tasks]);
  const selectedRecord = dashboard.recentRecords.find((item) => item.record.id === selectedRecordId) ?? null;
  const configured = useScoringStore((state) => state.configured);
  const today = useScoringStore((state) => state.today);
  const loading = useScoringStore((state) => state.loading);
  const error = useScoringStore((state) => state.error);
  const load = useScoringStore((state) => state.load);

  useEffect(() => { if (configured) void load(); }, [configured, load]);

  useEffect(() => {
    if (usage) return;
    let cancelled = false;
    const loadUsage = async () => {
      if (range.endAt - range.startAt > 31 * 24 * 60 * 60_000) {
        if (!cancelled) setLocalUsage({ status: 'unavailable', reason: '应用使用统计最多支持 31 天范围，其他专注图表不受影响。' });
        return;
      }
      setLocalUsage({ status: 'loading' });
      try {
        const status = await getUsageAccessStatus();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocalUsage({ status: status === 'denied' ? 'denied' : 'unavailable', reason: status === 'denied' ? '需要在系统设置中开启使用情况访问权限。' : '当前构建或平台不支持应用使用统计。' });
          return;
        }
        const result = await queryAppUsage(range.startAt, range.endAt);
        if (cancelled) return;
        setLocalUsage({ status: 'authorized', ...summarizeDeviceUsage(result, records) });
      } catch (usageError) {
        if (!cancelled) setLocalUsage({ status: 'unavailable', reason: usageError instanceof Error ? usageError.message : '应用使用统计读取失败。' });
      }
    };
    void loadUsage();
    return () => { cancelled = true; };
  }, [range.endAt, range.startAt, records, usage, usageRefresh]);

  const applyCustomRange = () => {
    try {
      createStatisticsRange('custom', anchor, { startDate: draftStartDate, endDate: draftEndDate });
      setCustomRange({ startDate: draftStartDate, endDate: draftEndDate });
      setRangeKind('custom');
      setRangeError(null);
      setCustomOpen(false);
    } catch (customError) {
      setRangeError(customError instanceof Error ? customError.message : '日期范围无效');
    }
  };

  return <View className="gap-3">
    <Card><Card.Body className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => <Button key={option.kind} size="sm" variant={rangeKind === option.kind ? 'primary' : 'secondary'} style={{ minWidth: compact ? 54 : 64, flexGrow: 1 }} onPress={() => {
          if (option.kind === 'custom') setCustomOpen(true);
          else setRangeKind(option.kind);
          setRangeError(null);
        }}>{option.label}</Button>)}
      </View>
      <View className="flex-row items-center gap-2">
        <Button size="sm" variant="secondary" accessibilityLabel="上一个时间范围" isDisabled={rangeKind === 'custom'} onPress={() => setAnchor((value) => shiftStatisticsAnchor(rangeKind as Exclude<StatisticsRangeKind, 'custom'>, value, -1))}>‹</Button>
        <View className="flex-1"><Text type="body-sm" color="muted" align="center">{range.label} · {granularityLabel(range.granularity)}</Text></View>
        <Button size="sm" variant="secondary" accessibilityLabel="下一个时间范围" isDisabled={rangeKind === 'custom'} onPress={() => setAnchor((value) => shiftStatisticsAnchor(rangeKind as Exclude<StatisticsRangeKind, 'custom'>, value, 1))}>›</Button>
      </View>
    </Card.Body></Card>

    <Card><Card.Body className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View><Card.Title>摘要</Card.Title><Card.Description>全部时长均按设备本地日期聚合</Card.Description></View>
        <Chip color={configured && !error ? 'success' : 'warning'}>{configured && !error ? '积分已同步' : '本地数据可用'}</Chip>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Metric compact={compact} dark={dark} label="专注时长" value={formatDuration(dashboard.summary.focusSeconds)} />
        <Metric compact={compact} dark={dark} label="完成 / 退出" value={`${dashboard.summary.completedSessions} / ${dashboard.summary.exitedSessions} 次`} />
        <Metric compact={compact} dark={dark} label="完成率" value={`${dashboard.summary.completionRate}%`} />
        <Metric compact={compact} dark={dark} label="活跃天数" value={`${dashboard.summary.activeDays} 天`} />
        <Metric compact={compact} dark={dark} label="日均专注" value={formatDuration(dashboard.summary.averageSecondsPerActiveDay)} />
        <Metric compact={compact} dark={dark} label="连续专注" value={`${dashboard.summary.currentStreakDays} 天`} />
      </View>
      {configured ? <View className="flex-row flex-wrap items-center justify-between gap-2"><Text type="body-sm" weight="semibold">今日积分：{today?.totalScore ?? '待刷新'}</Text><Button size="sm" variant="secondary" isDisabled={loading} onPress={() => void load()}>{loading ? '刷新中…' : '刷新积分'}</Button></View> : <Text type="body-xs" color="muted">积分同步未配置，不影响本地专注统计。</Text>}
      {error ? <Text type="body-xs" color="danger">积分加载失败：{error}</Text> : null}
    </Card.Body></Card>

    {dashboard.anomalies.length ? <Card variant="secondary"><Card.Body className="gap-2"><Card.Title>发现异常记录</Card.Title><Card.Description>这些记录已按可证明的计划时长显示，原始记录仍保留。</Card.Description>{dashboard.anomalies.slice(0, 5).map((item) => <View key={item.record.id} className="flex-row flex-wrap justify-between gap-2"><Text type="body-sm">{item.taskTitle}</Text><Text type="body-xs" color="danger">原始 {formatDuration(item.record.durationSeconds)} · 计划 {formatDuration(item.record.plannedFocusSeconds ?? 0)}</Text></View>)}</Card.Body></Card> : null}

    <TrendChart items={dashboard.trend} />
    <View className={compact ? 'gap-3' : 'flex-row gap-3'}>
      <View className="flex-1"><DistributionDonut title="任务分布" items={dashboard.distributions.task} /></View>
      <View className="flex-1"><DistributionDonut title="分类分布" items={dashboard.distributions.category} /></View>
    </View>
    <DistributionDonut title="模式分布" items={dashboard.distributions.mode} />
    <WeekTimelineChart days={dashboard.weekTimeline} />
    <StartTimeChart hours={dashboard.startTime.hours} bestHour={dashboard.startTime.bestHour} />
    <YearHeatmap year={dashboard.year} days={dashboard.yearHeatmap} />
    <RecentRecords records={dashboard.recentRecords} selectedRecordId={selectedRecordId} onSelect={setSelectedRecordId} />
    {selectedRecord ? <RecordDetail item={selectedRecord} /> : null}
    <UsageCard usage={usage ?? localUsage} compact={compact} dark={dark}
      onRequestAccess={() => void openUsageAccessSettings()} onRefresh={() => setUsageRefresh((value) => value + 1)} />
    <BottomSheetModal visible={customOpen} title="自定义统计范围" onClose={() => setCustomOpen(false)}>
      <View className={compact ? 'gap-2' : 'flex-row gap-2'}>
        <Input accessibilityLabel="开始日期" className="flex-1" value={draftStartDate} onChangeText={setDraftStartDate} placeholder="YYYY-MM-DD" />
        <Input accessibilityLabel="结束日期" className="flex-1" value={draftEndDate} onChangeText={setDraftEndDate} placeholder="YYYY-MM-DD" />
      </View>
      <Button size="sm" onPress={applyCustomRange}>应用自定义范围</Button>
      {rangeError ? <Text type="body-xs" color="danger" accessibilityRole="alert">{rangeError}</Text> : null}
    </BottomSheetModal>
  </View>;
}

function Metric({ label, value, compact, dark }: { label: string; value: string; compact: boolean; dark: boolean }) {
  return <View style={[styles.metric, dark && styles.metricDark, { width: compact ? '100%' : '31%' }]}><Text type="body-xs" color="muted">{label}</Text><Text type="body-sm" weight="semibold">{value}</Text></View>;
}

function RecentRecords({ records, selectedRecordId, onSelect }: { records: StatisticsRecentRecord[]; selectedRecordId: string | null; onSelect: (id: string) => void }) {
  return <Card variant="secondary"><Card.Body className="gap-2"><Card.Title>最近记录</Card.Title>
    {records.length ? records.map((item) => <Button key={item.record.id} variant="secondary" onPress={() => onSelect(item.record.id)}>
      <View className="w-full gap-1">
        <View className="flex-row flex-wrap items-center justify-between gap-2"><Text type="body-sm" weight="semibold">{item.taskTitle}</Text><View className="flex-row items-center gap-2">{selectedRecordId === item.record.id ? <Chip color="accent">查看中</Chip> : null}<Text type="body-xs" color="muted">{formatDateTime(item.record.endedAt)} · {formatDuration(item.record.durationSeconds)}</Text></View></View>
        <Text type="body-xs" color="muted">{item.category} · {modeLabel(item.record)} · {item.record.outcome === 'completed' ? '已完成' : '已退出'}</Text>
        {item.record.failureReason ? <Text type="body-xs" color="danger">复盘：{item.record.failureReason}</Text> : null}
      </View>
    </Button>) : <Text type="body-sm" color="muted">还没有专注记录</Text>}
  </Card.Body></Card>;
}

function RecordDetail({ item }: { item: StatisticsRecentRecord }) {
  const record = item.record;
  return <Card><Card.Body className="gap-2"><Card.Title>记录详情</Card.Title>
    <Detail label="任务" value={item.taskTitle} />
    <Detail label="分类" value={item.category} />
    <Detail label="模式" value={modeLabel(record)} />
    <Detail label="开始" value={formatDateTime(record.startedAt)} />
    <Detail label="时长" value={formatDuration(record.durationSeconds)} />
    <Detail label="结果" value={record.outcome === 'completed' ? '完成' : '退出/失败'} danger={record.outcome === 'exited'} />
    {record.completionNote ? <Detail label="完成内容" value={record.completionNote} /> : null}
    {record.failureReason ? <Detail label="复盘原因" value={record.failureReason} danger /> : null}
  </Card.Body></Card>;
}

function UsageCard({ usage, compact, dark, onRequestAccess, onRefresh }: { usage?: UsageStatisticsData; compact: boolean; dark: boolean; onRequestAccess(): void; onRefresh(): void }) {
  return <Card variant="secondary"><Card.Body className="gap-3"><View><Card.Title>屏幕使用统计</Card.Title><Card.Description>数据仅在本机读取和聚合，不上传服务器</Card.Description></View>
    {usage?.status === 'authorized' ? <>
      <Metric compact={compact} dark={dark} label="所选范围屏幕使用" value={formatDuration(usage.totalSeconds)} />
      {usage.apps.length ? usage.apps.slice(0, 5).map((app) => <View key={app.packageName} className="flex-row items-center justify-between gap-2"><Text type="body-sm" numberOfLines={1} style={{ flex: 1 }}>{app.label || app.packageName}</Text><Text type="body-sm" color="muted">{formatDuration(app.durationSeconds)}</Text></View>) : <Text type="body-sm" color="muted">已授权，但当前范围没有应用使用数据</Text>}
      <View className="gap-2"><Text type="body-sm" weight="semibold">专注中断 {usage.interruptionCount} 次</Text>{usage.interruptionApps.slice(0, 3).map((app) => <View key={app.packageName} className="flex-row justify-between gap-2"><Text type="body-xs" color="muted">{app.label || app.packageName}</Text><Text type="body-xs" color="muted">{app.count} 次</Text></View>)}</View>
      <Button size="sm" variant="secondary" onPress={onRefresh}>刷新应用使用数据</Button>
    </> : usage?.status === 'loading' ? <Text type="body-sm" color="muted">正在读取本机应用使用数据…</Text> : <View style={[styles.usagePlaceholder, dark && styles.usagePlaceholderDark]}><Text type="body-sm" color="muted">屏幕使用统计未授权或当前平台不可用。</Text>{usage?.reason ? <Text type="body-xs" color="muted">{usage.reason}</Text> : null}<View className="flex-row flex-wrap gap-2">{usage?.status === 'denied' ? <Button size="sm" onPress={onRequestAccess}>开启使用情况访问</Button> : null}<Button size="sm" variant="secondary" onPress={onRefresh}>重新检测</Button></View></View>}
  </Card.Body></Card>;
}

function Detail({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <View className="flex-row flex-wrap justify-between gap-2"><Text type="body-xs" color="muted">{label}</Text><Text type="body-sm" color={danger ? 'danger' : 'default'}>{value}</Text></View>;
}

function formatDuration(seconds: number) {
  const roundedMinutes = Math.round(seconds / 60);
  if (roundedMinutes < 60) return `${roundedMinutes} 分钟`;
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function modeLabel(record: FocusSessionRecord) {
  if (record.mode === 'lock') return '锁机';
  if (record.timerMode === 'untimed') return '自由计时';
  return record.timerMode === 'countup' ? '正计时' : '倒计时';
}

function granularityLabel(granularity: 'hour' | 'day' | 'month' | 'year') {
  return { hour: '按小时', day: '按天', month: '按月', year: '按年' }[granularity];
}

const styles = StyleSheet.create({
  metric: { flexGrow: 1, borderRadius: 12, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  metricDark: { backgroundColor: '#252B3A' },
  usagePlaceholder: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', padding: 12, gap: 4 },
  usagePlaceholderDark: { borderColor: '#4A4E57', backgroundColor: '#1B1D22' },
});
