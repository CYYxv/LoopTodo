import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
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

  return <View className="gap-3"><Card><Card.Body className="gap-3">
    <View className="flex-row flex-wrap items-center justify-between gap-2"><Card.Title>赛季与段位</Card.Title><Chip color={configured ? 'success' : 'warning'}>{configured ? rank?.season.name ?? '赛季' : '登录后启用'}</Chip></View>
    <View className="flex-row gap-2"><Metric label="当前段位" value={rank ? tiers[rank.tier] ?? rank.tier : '待同步'} /><Metric label="赛季积分" value={`${rank?.score ?? 0}`} /></View>
    {rank?.nextThreshold ? <Text type="body-xs" color="muted">距离下一段位还需 {Math.max(0, rank.nextThreshold - rank.score)} 分</Text> : null}
    <View className="flex-row flex-wrap gap-2">{Object.entries(periods).map(([key, label]) => <Button key={key} size="sm" variant={period === key ? 'primary' : 'secondary'} isDisabled={loading} onPress={() => void setPeriod(key as keyof typeof periods)}>{label}</Button>)}</View>
    {loading ? <Text type="body-sm" color="muted">正在加载排行榜…</Text> : null}
    {!loading && leaderboard.length === 0 ? <Text type="body-sm" color="muted">当前周期暂无排行榜数据</Text> : null}
    {leaderboard.slice(0, 10).map((item) => <View key={item.user.id} className="flex-row flex-wrap justify-between gap-2"><Text type="body-sm">#{item.position} {item.user.nickname}</Text><Text type="body-xs" color="muted">{item.score} 分 · {item.focusMinutes}m</Text></View>)}
  </Card.Body></Card>

  <Card variant="secondary"><Card.Body className="gap-3"><Card.Title>战队</Card.Title>
    {membership ? <><Text type="body-sm">{membership.team.name} · {membership.team.memberCount}/10000 人</Text><Text type="body-xs">邀请码：{membership.team.joinCode}</Text></> : <><Text type="body-sm" color="muted">尚未加入战队</Text><TextField><Label>创建战队</Label><Input value={teamName} onChangeText={setTeamName} /></TextField><Button size="sm" isDisabled={!configured || !teamName.trim()} onPress={() => void createTeam(teamName)}>免费创建</Button><TextField><Label>加入邀请码</Label><Input value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" /></TextField><Button size="sm" variant="secondary" isDisabled={!configured || !joinCode.trim()} onPress={() => void joinTeam(joinCode)}>加入战队</Button></>}
    {!loading && teams.length === 0 ? <Text type="body-sm" color="muted">暂无战队排行</Text> : null}
    {teams.slice(0, 10).map((team) => <View key={team.id} className="flex-row flex-wrap justify-between gap-2"><Text type="body-sm">#{team.position} {team.name}</Text><Text type="body-xs" color="muted">{team.score} · {team.memberCount}人</Text></View>)}
    {error ? <View className="gap-2"><Text type="body-xs" color="danger">{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button></View> : null}
  </Card.Body></Card></View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View className="flex-1"><Text type="body-xs" color="muted">{label}</Text><Text type="h4">{value}</Text></View>;
}
