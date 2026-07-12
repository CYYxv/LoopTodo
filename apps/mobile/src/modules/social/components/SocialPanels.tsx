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
import { useFamilyStore } from '@/modules/family/family.store';

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
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [childId, setChildId] = useState(''); const [taskTitle, setTaskTitle] = useState(''); const [minutes, setMinutes] = useState('25'); const [reason, setReason] = useState(''); const configured = useFamilyStore((state) => state.configured); const groups = useFamilyStore((state) => state.groups); const assignments = useFamilyStore((state) => state.assignments); const requests = useFamilyStore((state) => state.requests); const inviteCode = useFamilyStore((state) => state.inviteCode); const childStatus = useFamilyStore((state) => state.childStatus); const error = useFamilyStore((state) => state.error); const load = useFamilyStore((state) => state.load); const createGroup = useFamilyStore((state) => state.createGroup); const invite = useFamilyStore((state) => state.invite); const join = useFamilyStore((state) => state.join); const assign = useFamilyStore((state) => state.assign); const requestChange = useFamilyStore((state) => state.requestChange); const loadRequests = useFamilyStore((state) => state.loadRequests); const review = useFamilyStore((state) => state.review); const loadStatus = useFamilyStore((state) => state.loadStatus); useEffect(() => { if (configured) void load(); }, [configured, load]);
  return <View className="gap-3"><Card><Card.Body className="gap-3"><View className="flex-row items-center justify-between"><Card.Title>家庭组</Card.Title><Chip color={configured ? 'success' : 'warning'} variant="soft">{configured ? '已连接' : 'VIP 登录后启用'}</Chip></View><Card.Description>家长可下发任务和规则，但不能实时远程开启锁机；孩子只能提交修改或删除申请。</Card.Description><TextField><Label>新家庭名称</Label><Input value={name} onChangeText={setName} /></TextField><Button size="sm" isDisabled={!configured || !name.trim()} onPress={() => void createGroup(name)}>创建家庭组</Button><TextField><Label>加入邀请码</Label><Input value={code} onChangeText={setCode} autoCapitalize="characters" /></TextField><Button size="sm" variant="secondary" isDisabled={!configured || !code.trim()} onPress={() => void join(code)}>加入家庭组</Button>{inviteCode ? <Text type="body-xs">新邀请码：{inviteCode}</Text> : null}</Card.Body></Card>
    {groups.map((membership) => <Card key={membership.id} variant="secondary"><Card.Body className="gap-3"><Card.Title>{membership.familyGroup.name}</Card.Title><Text type="body-xs">我的角色：{membership.role === 'parent' ? '家长' : '孩子'}</Text>{membership.role === 'parent' ? <><View className="flex-row gap-2"><Button size="sm" onPress={() => void invite(membership.familyGroup.id, 'child')}>邀请孩子</Button><Button size="sm" variant="secondary" onPress={() => void invite(membership.familyGroup.id, 'parent')}>邀请家长</Button></View><TextField><Label>孩子用户 ID</Label><Input value={childId} onChangeText={setChildId} /></TextField><TextField><Label>下发任务</Label><Input value={taskTitle} onChangeText={setTaskTitle} /></TextField><TextField><Label>分钟</Label><Input value={minutes} onChangeText={setMinutes} keyboardType="numeric" /></TextField><Button size="sm" isDisabled={!childId || !taskTitle} onPress={() => void assign(membership.familyGroup.id, childId, taskTitle, Number(minutes))}>下发任务</Button><Button size="sm" variant="secondary" onPress={() => void loadRequests(membership.familyGroup.id)}>加载修改申请</Button>{(requests[membership.familyGroup.id] ?? []).map((item) => <View key={item.id} className="gap-1"><Text type="body-sm">{item.childMember.user.nickname}：{item.assignment.task.title}</Text><Text type="body-xs">{item.reason}</Text><View className="flex-row gap-2"><Button size="sm" onPress={() => void review(membership.familyGroup.id, item.id, 'approved')}>批准</Button><Button size="sm" variant="secondary" onPress={() => void review(membership.familyGroup.id, item.id, 'rejected')}>拒绝</Button></View></View>)}<Button size="sm" variant="secondary" isDisabled={!childId} onPress={() => void loadStatus(childId)}>查看孩子状态</Button>{childStatus ? <Text type="body-xs">任务 {childStatus.tasks.length} · 专注记录 {childStatus.sessions.length}</Text> : null}</> : null}</Card.Body></Card>)}
    {assignments.map((item) => <Card key={item.id} variant="secondary"><Card.Body className="gap-2"><Text type="body-sm">家长任务：{item.task.title}</Text><TextField><Label>申请原因</Label><Input value={reason} onChangeText={setReason} /></TextField><View className="flex-row gap-2"><Button size="sm" isDisabled={!reason.trim()} onPress={() => void requestChange(item.id, 'update', reason, `${item.task.title}（申请修改）`)}>申请修改</Button><Button size="sm" variant="secondary" isDisabled={!reason.trim()} onPress={() => void requestChange(item.id, 'delete', reason)}>申请删除</Button></View></Card.Body></Card>)}{error ? <Text type="body-xs">{error}</Text> : null}</View>;
}
