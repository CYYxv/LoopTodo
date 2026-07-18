import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from 'heroui-native/avatar';
import { ListGroup } from 'heroui-native/list-group';
import { Skeleton } from 'heroui-native/skeleton';
import { Surface } from 'heroui-native/surface';

import { Button, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import { useCompetitionStore } from '../competition.store';

const periods = { today: '今日', week: '本周', month: '本月', season: '赛季' } as const;
const tiers: Record<string, string> = { bronze: '青铜', silver: '白银', gold: '黄金', platinum: '铂金', diamond: '钻石', master: '大师' };

export function CompetitionPanel() {
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const configured = useCompetitionStore((state) => state.configured);
  const period = useCompetitionStore((state) => state.period);
  const rank = useCompetitionStore((state) => state.rank);
  const leaderboard = useCompetitionStore((state) => state.leaderboard);
  const membership = useCompetitionStore((state) => state.membership);
  const teams = useCompetitionStore((state) => state.teams);
  const loading = useCompetitionStore((state) => state.loading);
  const error = useCompetitionStore((state) => state.error);
  const load = useCompetitionStore((state) => state.load);
  const setPeriod = useCompetitionStore((state) => state.setPeriod);
  const createTeam = useCompetitionStore((state) => state.createTeam);
  const joinTeam = useCompetitionStore((state) => state.joinTeam);

  useEffect(() => { if (configured) void load(); }, [configured, load]);

  if (loading) {
    return <Skeleton accessibilityLabel="排行榜加载占位" accessibilityState={{ busy: true }} className="h-48 rounded-2xl" />;
  }

  return <View className="gap-4">
    <Surface accessibilityLabel="竞技概览" className="gap-4 rounded-2xl p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2"><Text type="body-lg" weight="semibold">赛季与段位</Text><Chip color={configured ? 'success' : 'warning'} variant="soft">{configured ? rank?.season.name ?? '赛季' : '登录后启用'}</Chip></View>
      <View className="flex-row gap-2"><Metric label="当前段位" value={rank ? tiers[rank.tier] ?? rank.tier : '待同步'} /><Metric label="赛季积分" value={`${rank?.score ?? 0}`} /></View>
      {rank?.nextThreshold ? <Text type="body-xs" color="muted">距离下一段位还需 {Math.max(0, rank.nextThreshold - rank.score)} 分</Text> : null}
      <View className="flex-row flex-wrap gap-2">{Object.entries(periods).map(([key, label]) => <Button key={key} size="sm" variant={period === key ? 'primary' : 'secondary'} onPress={() => void setPeriod(key as keyof typeof periods)}>{label}</Button>)}</View>
      <ListGroup accessibilityLabel="个人排行榜" variant="secondary">
        {leaderboard.length === 0 ? <ListGroup.Item disabled><ListGroup.ItemContent><ListGroup.ItemTitle>当前周期暂无排行榜数据</ListGroup.ItemTitle></ListGroup.ItemContent></ListGroup.Item> : leaderboard.slice(0, 10).map((item) => <ListGroup.Item key={item.user.id} disabled>
          <ListGroup.ItemPrefix><Avatar color="accent" variant="soft" size="sm"><Avatar.Fallback>{initials(item.user.nickname)}</Avatar.Fallback></Avatar></ListGroup.ItemPrefix>
          <ListGroup.ItemContent><ListGroup.ItemTitle>#{item.position} {item.user.nickname}</ListGroup.ItemTitle><ListGroup.ItemDescription>{item.focusMinutes} 分钟专注</ListGroup.ItemDescription></ListGroup.ItemContent>
          <ListGroup.ItemSuffix><Text type="body-sm" weight="semibold">{item.score} 分</Text></ListGroup.ItemSuffix>
        </ListGroup.Item>)}
      </ListGroup>
    </Surface>

    <Surface variant="secondary" className="gap-4 rounded-2xl p-4">
      <Text type="body-lg" weight="semibold">战队</Text>
      {membership ? <View className="gap-1"><Text type="body-sm">{membership.team.name} · {membership.team.memberCount}/10000 人</Text><Text type="body-xs" color="muted">邀请码：{membership.team.joinCode}</Text></View> : <View className="gap-3"><Text type="body-sm" color="muted">尚未加入战队</Text><TextField><Label>创建战队</Label><Input value={teamName} onChangeText={setTeamName} /></TextField><Button size="sm" isDisabled={!configured || !teamName.trim()} onPress={() => void createTeam(teamName)}>免费创建</Button><TextField><Label>加入邀请码</Label><Input value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" /></TextField><Button size="sm" variant="secondary" isDisabled={!configured || !joinCode.trim()} onPress={() => void joinTeam(joinCode)}>加入战队</Button></View>}
      <ListGroup accessibilityLabel="战队排行榜" variant="transparent">
        {teams.length === 0 ? <ListGroup.Item disabled><ListGroup.ItemContent><ListGroup.ItemTitle>暂无战队排行</ListGroup.ItemTitle></ListGroup.ItemContent></ListGroup.Item> : teams.slice(0, 10).map((team) => <ListGroup.Item key={team.id} disabled><ListGroup.ItemContent><ListGroup.ItemTitle>#{team.position} {team.name}</ListGroup.ItemTitle><ListGroup.ItemDescription>{team.memberCount} 人</ListGroup.ItemDescription></ListGroup.ItemContent><ListGroup.ItemSuffix><Text type="body-sm" weight="semibold">{team.score}</Text></ListGroup.ItemSuffix></ListGroup.Item>)}
      </ListGroup>
      {error ? <View className="gap-2"><Text type="body-xs" color="danger">{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button></View> : null}
    </Surface>
  </View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Surface variant="secondary" className="flex-1 rounded-xl p-3"><Text type="body-xs" color="muted">{label}</Text><Text type="h4" weight="semibold">{value}</Text></Surface>;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'LT';
}
