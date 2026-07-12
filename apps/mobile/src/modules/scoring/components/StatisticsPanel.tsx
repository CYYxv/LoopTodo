import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Text } from '@/ui/hero-runtime';

import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';
import { localStatistics } from '../scoring.local';
import { useScoringStore } from '../scoring.store';

export function StatisticsPanel({ records }: { records: FocusSessionRecord[] }) {
  const local = useMemo(() => localStatistics(records), [records]); const configured = useScoringStore((state) => state.configured);
  const today = useScoringStore((state) => state.today); const history = useScoringStore((state) => state.history);
  const loading = useScoringStore((state) => state.loading); const error = useScoringStore((state) => state.error); const load = useScoringStore((state) => state.load);
  useEffect(() => { if (configured) void load(); }, [configured, load]);
  return <View className="gap-3"><Card><Card.Body className="gap-3"><View className="flex-row items-center justify-between"><View><Card.Title>数据统计</Card.Title><Card.Description>本地记录即时可用，积分以服务端结算为准</Card.Description></View><Chip color={configured ? 'success' : 'warning'} variant="soft">{configured ? '已同步' : '本地统计'}</Chip></View>
    <View className="flex-row gap-2"><Metric label="今日专注" value={`${today?.focusMinutes ?? local.todayMinutes} 分钟`} /><Metric label="今日完成" value={`${today?.completedSessions ?? local.todayCompleted} 次`} /><Metric label="连续天数" value={`${today?.streakDays ?? local.streakDays} 天`} /></View>
    <View className="flex-row gap-2"><Metric label="累计时长" value={`${local.totalMinutes} 分钟`} /><Metric label="累计闭环" value={`${local.totalCompleted} 次`} /><Metric label="今日积分" value={configured ? `${today?.totalScore ?? 0}` : '待同步'} /></View>
    {configured ? <Button size="sm" variant="secondary" isDisabled={loading} onPress={() => void load()}>{loading ? '刷新中…' : '刷新服务端积分'}</Button> : <Text type="body-xs" color="muted">登录并同步后显示服务端可信积分；客户端不自行确认竞技积分。</Text>}{error ? <Text type="body-xs">{error}</Text> : null}
  </Card.Body></Card>
  {history.length ? <Card variant="secondary"><Card.Body className="gap-2"><Card.Title>最近记录</Card.Title>{history.slice(0, 7).map((item) => <View key={item.date} className="flex-row items-center justify-between"><Text type="body-sm">{item.date.slice(0, 10)}</Text><Text type="body-xs" color="muted">{item.focusMinutes} 分钟 · {item.totalScore} 分</Text></View>)}</Card.Body></Card> : null}</View>;
}
function Metric({ label, value }: { label: string; value: string }) { return <View className="flex-1 rounded-panel-inner bg-surface-secondary p-2"><Text type="body-xs" color="muted">{label}</Text><Text type="body-sm" weight="semibold">{value}</Text></View>; }
