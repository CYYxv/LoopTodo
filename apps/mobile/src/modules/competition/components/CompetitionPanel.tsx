import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from 'heroui-native/avatar';
import { ListGroup } from 'heroui-native/list-group';
import { Skeleton } from 'heroui-native/skeleton';
import { Surface } from 'heroui-native/surface';

import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import { formatStarBar, rankFromStars, tierLabels, type MajorTier } from '../star-rank';
import { useCompetitionStore } from '../competition.store';

const periods = { today: '今日', week: '本周', month: '本月', season: '赛季' } as const;

export function CompetitionPanel() {
  const router = useRouter();
  const [teamOpen, setTeamOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const configured = useCompetitionStore((state) => state.configured);
  const period = useCompetitionStore((state) => state.period);
  const rank = useCompetitionStore((state) => state.rank);
  const leaderboard = useCompetitionStore((state) => state.leaderboard);
  const selfRank = useCompetitionStore((state) => state.self);
  const membership = useCompetitionStore((state) => state.membership);
  const teams = useCompetitionStore((state) => state.teams);
  const recentEvents = useCompetitionStore((state) => state.recentEvents);
  const loading = useCompetitionStore((state) => state.loading);
  const error = useCompetitionStore((state) => state.error);
  const load = useCompetitionStore((state) => state.load);
  const setPeriod = useCompetitionStore((state) => state.setPeriod);
  const createTeam = useCompetitionStore((state) => state.createTeam);
  const joinTeam = useCompetitionStore((state) => state.joinTeam);

  useEffect(() => {
    if (configured) void load();
  }, [configured, load]);

  const progress = useMemo(() => {
    if (!rank) return rankFromStars(0);
    if (rank.displayName) {
      return {
        ...rankFromStars(rank.stars ?? rank.score ?? 0),
        displayName: rank.displayName,
        starsInSub: rank.starsInSub ?? rankFromStars(rank.stars ?? rank.score ?? 0).starsInSub,
        capacity: rank.starCapacity ?? rankFromStars(rank.stars ?? rank.score ?? 0).capacity,
        starsToNext: rank.starsToNext ?? null,
        nextDisplayName: rank.nextDisplayName ?? null,
        totalStars: rank.stars ?? rank.score ?? 0,
      };
    }
    return rankFromStars(rank.stars ?? rank.score ?? 0);
  }, [rank]);

  const seasonLabel = rank?.season?.name ?? '赛季';
  const daysLeft = useMemo(() => {
    if (!rank?.season?.endsAt) return null;
    const ms = new Date(rank.season.endsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }, [rank?.season?.endsAt]);

  const tierTitle = progress.displayName;
  const starLine = Number.isFinite(progress.capacity)
    ? formatStarBar(progress.starsInSub, progress.capacity as number)
    : `★ × ${progress.starsInSub}`;

  if (loading && !rank) {
    return <Skeleton accessibilityLabel="排位加载占位" accessibilityState={{ busy: true }} className="h-48 rounded-2xl" />;
  }

  return (
    <View className="gap-4">
      <Surface accessibilityLabel="段位与赛季" className="items-center gap-3 rounded-2xl p-5">
        <View className="w-full flex-row items-center justify-between">
          <Text type="body-sm" color="muted">{seasonLabel}</Text>
          <Text type="body-sm" color="muted">{daysLeft != null ? `还剩 ${daysLeft} 天` : '—'}</Text>
        </View>
        <View className="h-24 w-24 items-center justify-center rounded-full bg-accent/15">
          <Text type="body-sm" weight="semibold" color="accent">
            {tierLabels[(progress.tier as MajorTier)] ?? progress.tier}
          </Text>
          <Text type="body-xs" color="muted">徽章</Text>
        </View>
        <Text type="h4" weight="semibold">{tierTitle}</Text>
        <Text type="body-lg" color="accent">{rank?.starBar ?? starLine}</Text>
        {progress.nextDisplayName && progress.starsToNext != null ? (
          <Text type="body-sm" color="muted">再 {progress.starsToNext} 星升 {progress.nextDisplayName}</Text>
        ) : (
          <Text type="body-sm" color="muted">顶格段位 · 继续堆星</Text>
        )}
        <View className="h-2 w-full overflow-hidden rounded-full bg-default-200">
          <View
            className="h-full rounded-full bg-accent"
            style={{
              width: Number.isFinite(progress.capacity) && (progress.capacity as number) > 0
                ? `${Math.min(100, Math.round((progress.starsInSub / (progress.capacity as number)) * 100))}%`
                : '100%',
            }}
          />
        </View>
        <Text type="body-xs" color="muted">赛季星 {progress.totalStars} · 本赛季累计有效星</Text>
        <View className="w-full flex-row flex-wrap gap-2">
          <Button size="sm" className="flex-1" onPress={() => router.push('/(tabs)/tasks')}>开始排位专注</Button>
          <Button size="sm" variant="secondary" onPress={() => setRulesOpen(true)}>规则</Button>
        </View>
      </Surface>

      <Surface className="gap-3 rounded-2xl p-4">
        <Text type="body-lg" weight="semibold">榜单</Text>
        <View className="flex-row flex-wrap gap-2">
          {Object.entries(periods).map(([key, label]) => (
            <Button key={key} size="sm" variant={period === key ? 'primary' : 'secondary'} onPress={() => void setPeriod(key as keyof typeof periods)}>
              {label}
            </Button>
          ))}
        </View>
                {selfRank ? (
          <Surface variant="secondary" className="mb-1 gap-1 rounded-xl p-3" accessibilityLabel="我的榜单位置">
            <Text type="body-sm" weight="semibold">
              我的位置 · 第 {selfRank.position} 名
              {selfRank.positionDelta == null
                ? ''
                : selfRank.positionDelta > 0
                  ? ` · 升 ${selfRank.positionDelta}`
                  : selfRank.positionDelta < 0
                    ? ` · 降 ${Math.abs(selfRank.positionDelta)}`
                    : ' · 持平'}
            </Text>
            <Text type="body-xs" color="muted">
              {period === 'season' ? `${selfRank.score} 星` : `${selfRank.focusMinutes} 分钟专注`}
              {selfRank.user?.nickname ? ` · ${selfRank.user.nickname}` : ''}
            </Text>
          </Surface>
        ) : null}
<ListGroup accessibilityLabel="个人排位榜" variant="secondary">
          {leaderboard.length === 0 ? (
            <ListGroup.Item disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>当前周期暂无榜单数据</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
            </ListGroup.Item>
          ) : leaderboard.slice(0, 10).map((item) => (
            <ListGroup.Item key={item.user.id} disabled>
              <ListGroup.ItemPrefix>
                <Avatar color="accent" variant="soft" size="sm">
                  <Avatar.Fallback>{initials(item.user.nickname)}</Avatar.Fallback>
                </Avatar>
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>#{item.position} {item.user.nickname}</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>{item.focusMinutes} 分钟专注</ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix>
                <Text type="body-sm" weight="semibold">{period === 'season' ? `${item.score} 星` : `${item.focusMinutes} 分`}</Text>
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Surface>

      <Surface variant="secondary" className="gap-3 rounded-2xl p-4">
        <View className="flex-row items-center justify-between">
          <Text type="body-lg" weight="semibold">战队</Text>
          <Button size="sm" variant="ghost" onPress={() => setTeamOpen(true)}>{membership ? '详情' : '加入/创建'}</Button>
        </View>
        {membership ? (
          <View className="gap-1">
            <Text type="body-sm">{membership.team.name} · {membership.team.memberCount}/10000 人</Text>
            <Text type="body-xs" color="muted">邀请码：{membership.team.joinCode}</Text>
          </View>
        ) : (
          <Text type="body-sm" color="muted">尚未加入战队</Text>
        )}
        <ListGroup accessibilityLabel="战队排行榜" variant="transparent">
          {teams.slice(0, 5).map((team) => (
            <ListGroup.Item key={team.id} disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>#{team.position} {team.name}</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>{team.memberCount} 人</ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix><Text type="body-sm">{team.score}</Text></ListGroup.ItemSuffix>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Surface>

      
      <Surface className="gap-3 rounded-2xl p-4">
        <Text type="body-lg" weight="semibold">最近排位记录</Text>
        {recentEvents.length === 0 ? (
          <Text type="body-sm" color="muted">完成专注后，这里会显示 +星 / -星 与原因。</Text>
        ) : recentEvents.slice(0, 8).map((event) => (
          <View key={event.id} className="flex-row items-center justify-between">
            <Text type="body-sm" color="muted">{scoreEventLabel(event)}</Text>
            <Text type="body-sm" weight="semibold" color={event.totalScore >= 0 ? 'accent' : 'danger'}>
              {event.totalScore > 0 ? `+${event.totalScore}` : `${event.totalScore}`} 星
            </Text>
          </View>
        ))}
      </Surface>

      {error ? (
        <View className="gap-2">
          <Text type="body-xs" color="danger">{error}</Text>
          <Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button>
        </View>
      ) : null}
      {!configured ? <Chip color="warning" variant="soft">登录后同步赛季与排位</Chip> : null}

      <BottomSheetModal visible={rulesOpen} title="排位规则" onClose={() => setRulesOpen(false)}>
        <Text type="body-sm">· 有效专注满 25 分钟才记星，当次整星结算，不跨次保留进度。</Text>
        <Text type="body-sm">· 白名单可加星但最少；严格更高；锁机最高。</Text>
        <Text type="body-sm">· 锁机提前退出 -1 星；连续 3 天无记星 -1 星；PK 按分钟结算，胜负不加星。</Text>
        <Text type="body-sm">· 当日有效专注超过约 3 小时后，继续计星的收益会衰减。</Text>
        <Text type="body-sm">· 大段：青铜→白银→黄金→铂金→钻石→星耀→闭环。</Text>
        <Text type="body-sm">· 赛季约 6 个月；新赛季按上赛季下降 3 个大段。</Text>
      </BottomSheetModal>

      <BottomSheetModal visible={teamOpen} title="战队" onClose={() => setTeamOpen(false)}>
        {membership ? (
          <View className="gap-2">
            <Text type="body-sm">{membership.team.name}</Text>
            <Text type="body-xs" color="muted">角色：{membership.role === 'leader' ? '队长' : '成员'} · 邀请码 {membership.team.joinCode}</Text>
          </View>
        ) : (
          <View className="gap-3">
            <TextField><Label>创建战队</Label><Input value={teamName} onChangeText={setTeamName} /></TextField>
            <Button size="sm" isDisabled={!configured || !teamName.trim()} onPress={() => void createTeam(teamName)}>免费创建</Button>
            <TextField><Label>加入邀请码</Label><Input value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" /></TextField>
            <Button size="sm" variant="secondary" isDisabled={!configured || !joinCode.trim()} onPress={() => void joinTeam(joinCode)}>加入战队</Button>
          </View>
        )}
      </BottomSheetModal>
    </View>
  );
}

function scoreEventLabel(event: { outcome: string; formulaVersion: string; durationMinutes: number; trustLevel: string; totalScore: number }) {
  if (event.formulaVersion.includes('idle')) return '连续多日无记星';
  if (event.outcome === 'emergency_exit') return '提前退出锁机';
  if (event.totalScore === 0 && event.outcome === 'completed') return `专注 ${event.durationMinutes} 分钟未达门槛`;
  if (event.outcome === 'completed') {
    const mode = event.trustLevel === 'high' ? '锁机' : event.trustLevel === 'open' ? '白名单' : '严格';
    return `${mode}专注 ${event.durationMinutes} 分钟`;
  }
  return '专注未完成';
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'LT';
}
