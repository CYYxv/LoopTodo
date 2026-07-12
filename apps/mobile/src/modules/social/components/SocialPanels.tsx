import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Text } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

import { MetricCard } from '@/screens/components/DashboardChrome';
import { useSocialStore } from '../social.store';
import { CompetitionPanel } from '@/modules/competition/components/CompetitionPanel';

export function SocialPanel() {
  const [email, setEmail] = useState(''); const [roomName, setRoomName] = useState(''); const [inviteCode, setInviteCode] = useState('');
  const configured = useSocialStore((state) => state.configured); const friends = useSocialStore((state) => state.friends);
  const matches = useSocialStore((state) => state.matches); const rooms = useSocialStore((state) => state.rooms); const reactions = useSocialStore((state) => state.reactions);
  const loading = useSocialStore((state) => state.loading); const error = useSocialStore((state) => state.error); const load = useSocialStore((state) => state.load);
  const invite = useSocialStore((state) => state.invite); const accept = useSocialStore((state) => state.accept); const createPk = useSocialStore((state) => state.createPk);
  const createRoom = useSocialStore((state) => state.createRoom); const joinRoom = useSocialStore((state) => state.joinRoom); const joinByCode = useSocialStore((state) => state.joinByCode); const react = useSocialStore((state) => state.react);
  useEffect(() => { if (configured) void load(); }, [configured, load]);
  return (
    <View className="gap-4">
      <CompetitionPanel />
      <Card>
        <Card.Body className="gap-3">
          <View className="flex-row items-center justify-between"><Chip size="sm" color="accent" variant="soft">好友 PK</Chip><Chip size="sm" color={configured ? 'success' : 'warning'} variant="soft">{configured ? '实时已连接' : '登录后启用'}</Chip></View>
          <Card.Title>每日专注时长 PK</Card.Title><Card.Description>只比较当日完成专注分钟，不提供聊天。</Card.Description>
          <View className="flex-row gap-3">
            <MetricCard label="好友" value={`${friends.filter((item) => item.status === 'accepted').length}`} />
            <MetricCard label="今日 PK" value={`${matches.length}`} />
          </View>
          <TextField><Label>好友邮箱</Label><Input value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="friend@example.com" /></TextField>
          <Button size="sm" isDisabled={!configured || !email.trim()} onPress={() => void invite(email)}>发送好友邀请</Button>
          {friends.map((friend) => <View key={friend.id} className="flex-row items-center justify-between"><View><Text type="body-sm">{friend.user.nickname}</Text><Text type="body-xs" color="muted">{friend.status === 'accepted' ? '已是好友' : friend.direction === 'incoming' ? '等待你接受' : '已发送邀请'}</Text></View>
            {friend.status === 'pending' && friend.direction === 'incoming' ? <Button size="sm" onPress={() => void accept(friend.id)}>接受</Button> : friend.status === 'accepted' ? <Button size="sm" variant="secondary" onPress={() => void createPk(friend.user.id)}>发起 PK</Button> : null}</View>)}
          {matches.map((match) => <View key={match.id} className="rounded-panel-inner bg-surface-secondary p-3"><Text type="body-sm">{match.challenger.nickname} {match.challenger.minutes}m : {match.opponent.minutes}m {match.opponent.nickname}</Text></View>)}
        </Card.Body>
      </Card>
      <Card><Card.Body className="gap-3"><Card.Title>无聊天自习室</Card.Title><Card.Description>公开房间或邀请码私密房间，只允许发送励志表情。</Card.Description>
        <TextField><Label>房间名称</Label><Input value={roomName} onChangeText={setRoomName} placeholder="晚间自习室" /></TextField><View className="flex-row gap-2"><Button size="sm" isDisabled={!configured || !roomName.trim()} onPress={() => void createRoom(roomName, 'public')}>创建公开房</Button><Button size="sm" variant="secondary" isDisabled={!configured || !roomName.trim()} onPress={() => void createRoom(roomName, 'private')}>创建私密房</Button></View>
        <TextField><Label>私密房邀请码</Label><Input value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" /></TextField><Button size="sm" variant="secondary" isDisabled={!configured || !inviteCode.trim()} onPress={() => void joinByCode(inviteCode)}>使用邀请码加入</Button>
        {rooms.map((room) => <View key={room.id} className="gap-2 rounded-panel-inner bg-surface-secondary p-3"><View className="flex-row items-center justify-between"><View><Text type="body-sm">{room.name}</Text><Text type="body-xs" color="muted">{room.visibility === 'private' ? `私密 · ${room.memberCount} 人` : `公开 · ${room.memberCount} 人`}</Text></View><Button size="sm" onPress={() => void joinRoom(room)}>{room.joined ? '进入' : '加入'}</Button></View>
          {room.joined ? <View className="flex-row gap-2">{['💪', '🔥', '👏', '🌱', '🏁'].map((emoji) => <Text key={emoji} type="h4" onPress={() => void react(room.id, emoji)}>{emoji}</Text>)}</View> : null}{room.inviteCode ? <Text type="body-xs">邀请码：{room.inviteCode}</Text> : null}</View>)}
        {reactions.slice(-5).map((item, index) => <Text key={`${item.createdAt}-${index}`} type="body-xs">{item.nickname} {item.emoji}</Text>)}
        {loading ? <Text type="body-xs">加载中…</Text> : null}{error ? <Text type="body-xs">{error}</Text> : null}
      </Card.Body></Card>
    </View>
  );
}

export function FamilyPanel() {
  return (
    <Card>
      <Card.Body className="gap-3">
        <Chip size="sm" color="warning" variant="soft">
          家庭组
        </Chip>
        <Card.Title>家长任务与申请修改</Card.Title>
        <Card.Description>
          家长可下发任务和规则，孩子不能直接改删，只能申请修改；家长不能实时远程一键锁机。
        </Card.Description>
        <Button variant="secondary" isDisabled>
          家庭功能开发中
        </Button>
      </Card.Body>
    </Card>
  );
}
