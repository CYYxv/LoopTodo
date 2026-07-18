import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from 'heroui-native/avatar';
import { ListGroup } from 'heroui-native/list-group';
import { Skeleton } from 'heroui-native/skeleton';
import { Surface } from 'heroui-native/surface';

import { Button, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import { useSocialStore } from '../social.store';

export function SocialInteractionPanel() {
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

  useEffect(() => {
    if (!configured) return;
    setEnabled(true);
    void load();
    return () => setEnabled(false);
  }, [configured, load, setEnabled]);

  if (loading) {
    return <Skeleton accessibilityLabel="社交数据加载占位" accessibilityState={{ busy: true }} className="h-48 rounded-2xl" />;
  }

  return <View className="gap-4">
    <Surface accessibilityLabel="互动概览" className="gap-4 rounded-2xl p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2"><Chip color="accent" variant="soft">好友 PK</Chip><Chip color={configured ? 'success' : 'warning'} variant="soft">{configured ? '已连接' : '登录后启用'}</Chip></View>
      <View className="gap-1"><Text type="body-lg" weight="semibold">每日专注时长 PK</Text><Text type="body-sm" color="muted">只比较当日完成专注分钟，不提供聊天。</Text></View>
      <View className="flex-row gap-2"><Metric label="好友" value={friends.filter((item) => item.status === 'accepted').length} /><Metric label="今日 PK" value={matches.length} /></View>
      <TextField><Label>好友邮箱</Label><Input value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="friend@example.com" /></TextField>
      <Button size="sm" isDisabled={!configured || !email.trim()} onPress={() => void invite(email)}>发送好友邀请</Button>
      <ListGroup accessibilityLabel="好友与邀请" variant="secondary">
        {friends.length === 0 ? <ListGroup.Item disabled><ListGroup.ItemContent><ListGroup.ItemTitle>暂无好友或待处理邀请</ListGroup.ItemTitle></ListGroup.ItemContent></ListGroup.Item> : friends.map((friend) => <ListGroup.Item key={friend.id} disabled>
          <ListGroup.ItemPrefix><Avatar color="accent" variant="soft" size="sm"><Avatar.Fallback>{initials(friend.user.nickname)}</Avatar.Fallback></Avatar></ListGroup.ItemPrefix>
          <ListGroup.ItemContent><ListGroup.ItemTitle>{friend.user.nickname}</ListGroup.ItemTitle><ListGroup.ItemDescription>{friend.status === 'accepted' ? '已是好友' : friend.direction === 'incoming' ? '等待你接受' : '已发送邀请'}</ListGroup.ItemDescription></ListGroup.ItemContent>
          <ListGroup.ItemSuffix>{friend.status === 'pending' && friend.direction === 'incoming' ? <Button size="sm" onPress={() => void accept(friend.id)}>接受</Button> : friend.status === 'accepted' ? <Button size="sm" variant="secondary" onPress={() => void createPk(friend.user.id)}>发起 PK</Button> : null}</ListGroup.ItemSuffix>
        </ListGroup.Item>)}
      </ListGroup>
      {matches.map((match) => <Surface key={match.id} variant="secondary" className="rounded-xl p-3"><Text type="body-sm">{match.challenger.nickname} {match.challenger.minutes}m : {match.opponent.minutes}m {match.opponent.nickname}</Text></Surface>)}
      {matches.length === 0 ? <Text type="body-sm" color="muted">今天还没有好友 PK</Text> : null}
    </Surface>

    <Surface className="gap-4 rounded-2xl p-4">
      <View className="gap-1"><Text type="body-lg" weight="semibold">无聊天自习室</Text><Text type="body-sm" color="muted">公开房间或邀请码私密房间，只允许发送励志表情。</Text></View>
      <TextField><Label>房间名称</Label><Input value={roomName} onChangeText={setRoomName} placeholder="晚间自习室" /></TextField>
      <View className="flex-row flex-wrap gap-2"><Button size="sm" isDisabled={!configured || !roomName.trim()} onPress={() => void createRoom(roomName, 'public')}>创建公开房</Button><Button size="sm" variant="secondary" isDisabled={!configured || !roomName.trim()} onPress={() => void createRoom(roomName, 'private')}>创建私密房</Button></View>
      <TextField><Label>私密房邀请码</Label><Input value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" /></TextField>
      <Button size="sm" variant="secondary" isDisabled={!configured || !inviteCode.trim()} onPress={() => void joinByCode(inviteCode)}>使用邀请码加入</Button>
      <ListGroup accessibilityLabel="自习室列表" variant="secondary">
        {rooms.length === 0 ? <ListGroup.Item disabled><ListGroup.ItemContent><ListGroup.ItemTitle>暂无可加入的自习室</ListGroup.ItemTitle></ListGroup.ItemContent></ListGroup.Item> : rooms.map((room) => <ListGroup.Item key={room.id} disabled>
          <ListGroup.ItemContent><ListGroup.ItemTitle>{room.name}</ListGroup.ItemTitle><ListGroup.ItemDescription>{room.visibility === 'private' ? `私密 · ${room.memberCount} 人${room.inviteCode ? ` · 邀请码 ${room.inviteCode}` : ''}` : `公开 · ${room.memberCount} 人`}</ListGroup.ItemDescription></ListGroup.ItemContent>
          <ListGroup.ItemSuffix><Button size="sm" onPress={() => void joinRoom(room)}>{room.joined ? '进入' : '加入'}</Button></ListGroup.ItemSuffix>
        </ListGroup.Item>)}
      </ListGroup>
      {rooms.filter((room) => room.joined).map((room) => <View key={`${room.id}-reactions`} className="flex-row gap-3">{['💪', '🔥', '👏', '🌱', '🏆'].map((emoji) => <Text key={emoji} type="h4" onPress={() => void react(room.id, emoji)}>{emoji}</Text>)}</View>)}
      {reactions.slice(-5).map((item, index) => <Text key={`${item.createdAt}-${index}`} type="body-xs">{item.nickname} {item.emoji}</Text>)}
      {error ? <View className="gap-2"><Text type="body-xs" color="danger">{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button></View> : null}
    </Surface>
  </View>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Surface variant="secondary" className="flex-1 rounded-xl p-3"><Text type="body-xs" color="muted">{label}</Text><Text type="h4" weight="semibold">{value}</Text></Surface>;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'LT';
}
