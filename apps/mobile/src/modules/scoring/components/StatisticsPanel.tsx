import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Text } from '@/ui/hero-runtime';
import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';
import type { Task } from '@/modules/tasks/task.types';

import { localStatistics } from '../scoring.local';
import { useScoringStore } from '../scoring.store';

type Scope = 'today' | 'all';

export function StatisticsPanel({ records, tasks }: { records: FocusSessionRecord[]; tasks: Task[] }) {
  const [scope, setScope] = useState<Scope>('today');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const local = useMemo(() => localStatistics(records), [records]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const scopedRecords = useMemo(() => records
    .filter((record) => scope === 'all' || sameDay(record.endedAt, Date.now()))
    .sort((left, right) => right.endedAt - left.endedAt), [records, scope]);
  const failedRecords = useMemo(() => scopedRecords.filter((record) => record.outcome === 'exited'), [scopedRecords]);
  const modeDistribution = useMemo(() => distribution(scopedRecords), [scopedRecords]);
  const selectedRecord = scopedRecords.find((record) => record.id === selectedRecordId) ?? null;
  const configured = useScoringStore((state) => state.configured);
  const today = useScoringStore((state) => state.today);
  const loading = useScoringStore((state) => state.loading);
  const error = useScoringStore((state) => state.error);
  const load = useScoringStore((state) => state.load);

  useEffect(() => { if (configured) void load(); }, [configured, load]);

  const summary = scope === 'today'
    ? { minutes: local.todayMinutes, completed: local.todayCompleted, failed: local.todayFailed }
    : { minutes: local.totalMinutes, completed: local.totalCompleted, failed: local.totalFailed };

  return <View className="gap-3">
    <View className="flex-row gap-2">
      <Button className="flex-1" variant={scope === 'today' ? 'primary' : 'secondary'} onPress={() => setScope('today')}>今日</Button>
      <Button className="flex-1" variant={scope === 'all' ? 'primary' : 'secondary'} onPress={() => setScope('all')}>累计</Button>
    </View>

    <Card><Card.Body className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-48 flex-1"><Card.Title>{scope === 'today' ? '今日数据' : '累计数据'}</Card.Title><Card.Description>本地记录即时展示，积分将在联网后同步</Card.Description></View>
        <Chip color={configured && !error ? 'success' : 'warning'}>{configured && !error ? '积分已同步' : '本地数据可用'}</Chip>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Metric label="专注时长" value={`${summary.minutes} 分钟`} />
        <Metric label="完成闭环" value={`${summary.completed} 次`} />
        <Metric label="失败/退出" value={`${summary.failed} 次`} />
        {scope === 'today' ? <Metric label="连续天数" value={`${local.streakDays} 天`} /> : null}
      </View>
      {configured ? <View className="gap-2"><Text type="body-sm" weight="semibold">今日积分：{today?.totalScore ?? '待刷新'}</Text><Button size="sm" variant="secondary" isDisabled={loading} onPress={() => void load()}>{loading ? '刷新中…' : '刷新积分'}</Button></View> : <Text type="body-xs" color="muted">登录并同步后显示积分；加载失败不会覆盖本地统计。</Text>}
      {error ? <View className="gap-2"><Text type="body-xs" color="danger">积分加载失败：{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试积分加载</Button></View> : null}
    </Card.Body></Card>

    <Card variant="secondary"><Card.Body className="gap-3">
      <Card.Title>最近 7 天趋势</Card.Title>
      <View className="flex-row items-end gap-2" style={{ height: 116 }}>
        {local.dailyTrend.map((item) => <View key={item.date} className="flex-1 items-center justify-end gap-1">
          <Text type="body-xs" color="muted">{item.minutes}</Text>
          <View className="w-full rounded-panel-inner" style={{ height: Math.max(4, item.ratio * 72), backgroundColor: '#2563EB' }} />
          <Text type="body-xs" color="muted">{item.label}</Text>
        </View>)}
      </View>
    </Card.Body></Card>

    <Card variant="secondary"><Card.Body className="gap-3">
      <Card.Title>专注方式分布</Card.Title>
      <View className="flex-row flex-wrap gap-2">
        <Metric label="锁机" value={`${modeDistribution.lock} 次`} />
        <Metric label="标准" value={`${modeDistribution.standard} 次`} />
        <Metric label="自由" value={`${modeDistribution.free} 次`} />
      </View>
    </Card.Body></Card>

    <RecordList title="最近专注" records={scopedRecords.slice(0, 8)} taskById={taskById} selectedRecordId={selectedRecordId} onSelect={setSelectedRecordId} empty="当前范围还没有专注记录" />
    <RecordList title="失败复盘" records={failedRecords.slice(0, 8)} taskById={taskById} selectedRecordId={selectedRecordId} onSelect={setSelectedRecordId} empty="当前范围没有失败记录" showFailureReason />
    {selectedRecord ? <RecordDetail record={selectedRecord} task={taskById.get(selectedRecord.taskId)} /> : null}
  </View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View className="min-w-28 flex-1 rounded-panel-inner bg-surface-secondary p-2"><Text type="body-xs" color="muted">{label}</Text><Text type="body-sm" weight="semibold">{value}</Text></View>;
}

function RecordList({ title, records, taskById, selectedRecordId, onSelect, empty, showFailureReason = false }: { title: string; records: FocusSessionRecord[]; taskById: Map<string, Task>; selectedRecordId: string | null; onSelect: (id: string) => void; empty: string; showFailureReason?: boolean }) {
  return <Card variant="secondary"><Card.Body className="gap-2"><Card.Title>{title}</Card.Title>
    {records.length ? records.map((record) => <Button key={record.id} variant="secondary" onPress={() => onSelect(record.id)}>
      <View className="w-full gap-1"><View className="flex-row flex-wrap items-center justify-between gap-2"><Text type="body-sm" weight="semibold">{taskById.get(record.taskId)?.title ?? '已删除任务'}</Text><View className="flex-row items-center gap-2">{selectedRecordId === record.id ? <Chip color="accent">查看中</Chip> : null}<Text type="body-xs" color="muted">{formatDateTime(record.endedAt)} · {Math.floor(record.durationSeconds / 60)} 分钟</Text></View></View>{showFailureReason && record.failureReason ? <Text type="body-xs" color="danger">复盘：{record.failureReason}</Text> : null}</View>
    </Button>) : <Text type="body-sm" color="muted">{empty}</Text>}
  </Card.Body></Card>;
}

function RecordDetail({ record, task }: { record: FocusSessionRecord; task?: Task }) {
  return <Card><Card.Body className="gap-2"><Card.Title>记录详情</Card.Title>
    <Detail label="任务" value={task?.title ?? '已删除任务'} />
    <Detail label="模式" value={`${record.mode === 'lock' ? '锁机' : '专注'} · ${timerLabel(record.timerMode)}`} />
    <Detail label="时长" value={`${Math.floor(record.durationSeconds / 60)} 分钟 ${record.durationSeconds % 60} 秒`} />
    <Detail label="结果" value={record.outcome === 'completed' ? '完成' : '退出/失败'} />
    {record.completedAmount != null ? <Detail label="完成量" value={`${record.completedAmount}${task?.targetUnit ?? ''}`} /> : null}
    {record.failureReason ? <Detail label="复盘原因" value={record.failureReason} danger /> : null}
  </Card.Body></Card>;
}

function Detail({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <View className="flex-row flex-wrap justify-between gap-2"><Text type="body-xs" color="muted">{label}</Text><Text type="body-sm" color={danger ? 'danger' : 'default'}>{value}</Text></View>;
}

function distribution(records: FocusSessionRecord[]) {
  const result = { lock: 0, standard: 0, free: 0 };
  for (const record of records) {
    if (record.mode === 'lock') result.lock += 1;
    else if (record.timerMode === 'untimed') result.free += 1;
    else result.standard += 1;
  }
  return result;
}

function sameDay(left: number, right: number) { const first = new Date(left); const second = new Date(right); return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate(); }
function formatDateTime(value: number) { return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function timerLabel(mode: FocusSessionRecord['timerMode']) { return { countdown: '倒计时', countup: '正计时', untimed: '不计时' }[mode]; }
