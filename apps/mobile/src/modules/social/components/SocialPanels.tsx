import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { CompetitionPanel } from '@/modules/competition/components/CompetitionPanel';
import { useSettingsStore } from '@/modules/settings/settings.store';
import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import { useSocialStore } from '../social.store';

export function SocialPanel() {
  const [email, setEmail] = useState('');
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const configured = useSocialStore((state) => state.configured);
  const friends = useSocialStore((state) => state.friends);
  const matches = useSocialStore((state) => state.matches);
  const rooms = useSocialStore((state) => state.rooms);
  const reactions = useSocialStore((state) => state.reactions);
  const loading = useSocialStore((state) => state.loading);
  const error = useSocialStore((state) => state.error);
  const load = useSocialStore((state) => state.load);
  const setEnabled = useSocialStore((state) => state.setEnabled);
  const invite = useSocialStore((state) => state.invite);
  const accept = useSocialStore((state) => state.accept);
  const createPk = useSocialStore((state) => state.createPk);
  const createRoom = useSocialStore((state) => state.createRoom);
  const joinRoom = useSocialStore((state) => state.joinRoom);
  const joinByCode = useSocialStore((state) => state.joinByCode);
  const react = useSocialStore((state) => state.react);
  const settingsConfigured = useSettingsStore((state) => state.configured);
  const settings = useSettingsStore((state) => state.value);
  const settingsError = useSettingsStore((state) => state.error);
  const loadSettings = useSettingsStore((state) => state.load);
  const socialEnabled = settings?.socialEnabled ?? false;

  useEffect(() => {
    setEnabled(configured && socialEnabled);
    if (configured && socialEnabled) void load();
  }, [configured, load, setEnabled, socialEnabled]);
  useEffect(() => { if (settingsConfigured && !settings) void loadSettings(); }, [loadSettings, settings, settingsConfigured]);

  if (settingsConfigured && !settings) {
    return <Card><Card.Body className="gap-3"><Card.Title>正在读取社交设置</Card.Title><Card.Description>{settingsError ?? '确认你的隐私开关后才会连接社交服务。'}</Card.Description>{settingsError ? <Button size="sm" variant="secondary" onPress={() => void loadSettings()}>重试</Button> : null}</Card.Body></Card>;
  }

  if (!socialEnabled) {
    return <Card><Card.Body className="gap-3"><Card.Title>社交功能已关闭</Card.Title><Card.Description>好友、战队、自习室与排行榜均不会发起请求或保持实时连接。</Card.Description></Card.Body></Card>;
  }

  return <View className="gap-4">
    <CompetitionPanel />
    <Card><Card.Body className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2"><Chip color="accent">好友 PK</Chip><Chip color={configured ? 'success' : 'warning'}>{configured ? '已连接' : '登录后启用'}</Chip></View>
      <Card.Title>每日专注时长 PK</Card.Title><Card.Description>只比较当日完成专注分钟，不提供聊天。</Card.Description>
      <View className="flex-row gap-2"><Metric label="好友" value={friends.filter((item) => item.status === 'accepted').length} /><Metric label="今日 PK" value={matches.length} /></View>
      <TextField><Label>好友邮箱</Label><Input value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="friend@example.com" /></TextField>
      <Button size="sm" isDisabled={!configured || loading || !email.trim()} onPress={() => void invite(email)}>发送好友邀请</Button>
      {!loading && friends.length === 0 ? <Text type="body-sm" color="muted">暂无好友或待处理邀请</Text> : null}
      {friends.map((friend) => <View key={friend.id} className="flex-row flex-wrap items-center justify-between gap-2"><View><Text type="body-sm">{friend.user.nickname}</Text><Text type="body-xs" color="muted">{friend.status === 'accepted' ? '已是好友' : friend.direction === 'incoming' ? '等待你接受' : '已发送邀请'}</Text></View>{friend.status === 'pending' && friend.direction === 'incoming' ? <Button size="sm" onPress={() => void accept(friend.id)}>接受</Button> : friend.status === 'accepted' ? <Button size="sm" variant="secondary" onPress={() => void createPk(friend.user.id)}>发起 PK</Button> : null}</View>)}
      {matches.map((match) => <View key={match.id} className="rounded-panel-inner bg-surface-secondary p-3"><Text type="body-sm">{match.challenger.nickname} {match.challenger.minutes}m : {match.opponent.minutes}m {match.opponent.nickname}</Text></View>)}
      {!loading && matches.length === 0 ? <Text type="body-sm" color="muted">今天还没有好友 PK</Text> : null}
    </Card.Body></Card>

    <Card><Card.Body className="gap-3"><Card.Title>无聊天自习室</Card.Title><Card.Description>公开房间或邀请码私密房间，只允许发送励志表情。</Card.Description>
      <TextField><Label>房间名称</Label><Input value={roomName} onChangeText={setRoomName} placeholder="晚间自习室" /></TextField>
      <View className="flex-row flex-wrap gap-2"><Button size="sm" isDisabled={!configured || loading || !roomName.trim()} onPress={() => void createRoom(roomName, 'public')}>创建公开房</Button><Button size="sm" variant="secondary" isDisabled={!configured || loading || !roomName.trim()} onPress={() => void createRoom(roomName, 'private')}>创建私密房</Button></View>
      <TextField><Label>私密房邀请码</Label><Input value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" /></TextField>
      <Button size="sm" variant="secondary" isDisabled={!configured || loading || !inviteCode.trim()} onPress={() => void joinByCode(inviteCode)}>使用邀请码加入</Button>
      {!loading && rooms.length === 0 ? <Text type="body-sm" color="muted">暂无可加入的自习室</Text> : null}
      {rooms.map((room) => <View key={room.id} className="gap-2 rounded-panel-inner bg-surface-secondary p-3"><View className="flex-row flex-wrap items-center justify-between gap-2"><View><Text type="body-sm">{room.name}</Text><Text type="body-xs" color="muted">{room.visibility === 'private' ? `私密 · ${room.memberCount} 人` : `公开 · ${room.memberCount} 人`}</Text></View><Button size="sm" onPress={() => void joinRoom(room)}>{room.joined ? '进入' : '加入'}</Button></View>{room.joined ? <View className="flex-row gap-3">{['💪', '🔥', '👏', '🌱', '🏆'].map((emoji) => <Text key={emoji} type="h4" onPress={() => void react(room.id, emoji)}>{emoji}</Text>)}</View> : null}{room.inviteCode ? <Text type="body-xs">邀请码：{room.inviteCode}</Text> : null}</View>)}
      {reactions.slice(-5).map((item, index) => <Text key={`${item.createdAt}-${index}`} type="body-xs">{item.nickname} {item.emoji}</Text>)}
      {loading ? <Text type="body-xs" color="muted">正在加载社交数据…</Text> : null}
      {error ? <View className="gap-2"><Text type="body-xs" color="danger">{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button></View> : null}
    </Card.Body></Card>
  </View>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View className="flex-1 rounded-panel-inner bg-surface-secondary p-3"><Text type="body-xs" color="muted">{label}</Text><Text type="h4" weight="semibold">{value}</Text></View>;
}
