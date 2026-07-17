import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import { useFamilyStore } from '../family.store';

export function FamilyPanel() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [childId, setChildId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [restMinutes, setRestMinutes] = useState('5');
  const [taskType, setTaskType] = useState<'pomodoro' | 'goal'>('pomodoro');
  const [deadline, setDeadline] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetUnit, setTargetUnit] = useState('页');
  const [mustDo, setMustDo] = useState(false);
  const [triggerTime, setTriggerTime] = useState('20:00');
  const [reason, setReason] = useState('');
  const configured = useFamilyStore((state) => state.configured);
  const groups = useFamilyStore((state) => state.groups);
  const assignments = useFamilyStore((state) => state.assignments);
  const requests = useFamilyStore((state) => state.requests);
  const inviteCode = useFamilyStore((state) => state.inviteCode);
  const childStatus = useFamilyStore((state) => state.childStatus);
  const loading = useFamilyStore((state) => state.loading);
  const error = useFamilyStore((state) => state.error);
  const load = useFamilyStore((state) => state.load);
  const createGroup = useFamilyStore((state) => state.createGroup);
  const invite = useFamilyStore((state) => state.invite);
  const join = useFamilyStore((state) => state.join);
  const assign = useFamilyStore((state) => state.assign);
  const leave = useFamilyStore((state) => state.leave);
  const requestChange = useFamilyStore((state) => state.requestChange);
  const loadRequests = useFamilyStore((state) => state.loadRequests);
  const review = useFamilyStore((state) => state.review);
  const loadStatus = useFamilyStore((state) => state.loadStatus);

  useEffect(() => { if (configured) void load(); }, [configured, load]);

  return <View className="gap-3">
    {loading ? <Card><Card.Body><Text type="body-sm" color="muted">正在加载家庭信息…</Text></Card.Body></Card> : null}
    {!loading && groups.length === 0 ? <Card><Card.Body className="gap-2"><Card.Title>尚未加入家庭组</Card.Title><Card.Description>家庭管理属于 VIP 扩展权益。你仍可使用全部个人任务与专注功能。</Card.Description></Card.Body></Card> : null}

    {groups.map((membership) => <Card key={membership.id}><Card.Body className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2"><View><Card.Title>{membership.familyGroup.name}</Card.Title><Card.Description>我的角色：{membership.role === 'parent' ? '家长' : '孩子'}</Card.Description></View><Chip color="accent">{membership.familyGroup.members.length} 名成员</Chip></View>
      <View className="gap-1">{membership.familyGroup.members.map((member) => <Text key={member.id} type="body-sm">{member.user.nickname} · {member.role === 'parent' ? '家长' : '孩子'}</Text>)}</View>
      <Button size="sm" variant="danger-soft" onPress={() => void leave(membership.familyGroup.id)}>退出家庭</Button>
      {membership.role === 'parent' ? <View className="gap-3">
        <View className="flex-row flex-wrap gap-2"><Button size="sm" onPress={() => void invite(membership.familyGroup.id, 'child')}>邀请孩子</Button><Button size="sm" variant="secondary" onPress={() => void invite(membership.familyGroup.id, 'parent')}>邀请家长</Button></View>
        {inviteCode ? <Text type="body-sm" weight="semibold">新邀请码：{inviteCode}</Text> : null}
        <Text type="body-sm" weight="semibold">选择孩子</Text>
        <View className="flex-row flex-wrap gap-2">{membership.familyGroup.members.filter((member) => member.role === 'child').map((member) => <Button key={member.id} size="sm" variant={childId === member.user.id ? 'primary' : 'secondary'} onPress={() => setChildId(member.user.id)}>{member.user.nickname}</Button>)}</View>
        <TextField><Label>下发任务</Label><Input value={taskTitle} onChangeText={setTaskTitle} /></TextField>
        <View className="flex-row gap-2"><Button className="flex-1" size="sm" variant={taskType === 'pomodoro' ? 'primary' : 'secondary'} onPress={() => setTaskType('pomodoro')}>普通任务</Button><Button className="flex-1" size="sm" variant={taskType === 'goal' ? 'primary' : 'secondary'} onPress={() => setTaskType('goal')}>目标任务</Button></View>
        <TextField><Label>分钟</Label><Input value={minutes} onChangeText={setMinutes} keyboardType="numeric" /></TextField>
        <TextField><Label>休息分钟</Label><Input value={restMinutes} onChangeText={setRestMinutes} keyboardType="numeric" /></TextField>
        {taskType === 'goal' ? <><TextField><Label>截止日期</Label><Input value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" /></TextField><TextField><Label>目标量</Label><Input value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" /></TextField><TextField><Label>单位</Label><Input value={targetUnit} onChangeText={setTargetUnit} /></TextField></> : null}
        <Button size="sm" variant={mustDo ? 'danger-soft' : 'secondary'} onPress={() => setMustDo((value) => !value)}>{mustDo ? '今日必须已开启' : '设为今日必须'}</Button>
        {mustDo ? <TextField><Label>强制触发时间</Label><Input value={triggerTime} onChangeText={setTriggerTime} placeholder="HH:mm" /></TextField> : null}
        <Button size="sm" isDisabled={!childId.trim() || !taskTitle.trim() || Number(minutes) <= 0 || (taskType === 'goal' && (!deadline || Number(targetAmount) <= 0 || !targetUnit.trim()))} onPress={() => void assign(membership.familyGroup.id, { childUserId: childId, title: taskTitle, taskType, timerMode: taskType === 'goal' ? 'countdown' : 'countdown', estimatedMinutes: Number(minutes), restMinutes: Number(restMinutes), deadlineAt: taskType === 'goal' ? new Date(`${deadline}T23:59:59`).toISOString() : undefined, targetAmount: taskType === 'goal' ? Number(targetAmount) : undefined, targetUnit: taskType === 'goal' ? targetUnit : undefined, isTodayRequired: mustDo, triggerTime: mustDo ? triggerTime : undefined })}>下发任务</Button>
        <Button size="sm" variant="secondary" onPress={() => void loadRequests(membership.familyGroup.id)}>加载修改申请</Button>
        {(requests[membership.familyGroup.id] ?? []).map((item) => <View key={item.id} className="gap-2 rounded-panel-inner bg-surface-secondary p-3"><Text type="body-sm">{item.childMember.user.nickname}：{item.assignment.task.title}</Text><Text type="body-xs" color="muted">{item.reason}</Text><View className="flex-row gap-2"><Button size="sm" onPress={() => void review(membership.familyGroup.id, item.id, 'approved')}>批准</Button><Button size="sm" variant="secondary" onPress={() => void review(membership.familyGroup.id, item.id, 'rejected')}>拒绝</Button></View></View>)}
        <Button size="sm" variant="secondary" isDisabled={!childId.trim()} onPress={() => void loadStatus(childId)}>查看孩子状态</Button>
        {childStatus ? <Text type="body-xs">任务 {childStatus.tasks.length} · 专注记录 {childStatus.sessions.length}</Text> : null}
      </View> : null}
    </Card.Body></Card>)}

    {assignments.map((item) => <Card key={item.id} variant="secondary"><Card.Body className="gap-2"><Card.Title>家长任务：{item.task.title}</Card.Title><TextField><Label>申请原因</Label><Input value={reason} onChangeText={setReason} /></TextField><View className="flex-row flex-wrap gap-2"><Button size="sm" isDisabled={!reason.trim()} onPress={() => void requestChange(item.id, 'update', reason, `${item.task.title}（申请修改）`)}>申请修改</Button><Button size="sm" variant="secondary" isDisabled={!reason.trim()} onPress={() => void requestChange(item.id, 'delete', reason)}>申请删除</Button></View></Card.Body></Card>)}

    <Card variant="secondary"><Card.Body className="gap-3"><Card.Title>创建或加入家庭</Card.Title><Card.Description>创建家庭需要 VIP；使用有效邀请码加入已有家庭。</Card.Description><TextField><Label>新家庭名称</Label><Input value={name} onChangeText={setName} /></TextField><Button size="sm" isDisabled={!configured || !name.trim()} onPress={() => void createGroup(name)}>创建家庭组</Button><TextField><Label>加入邀请码</Label><Input value={code} onChangeText={setCode} autoCapitalize="characters" /></TextField><Button size="sm" variant="secondary" isDisabled={!configured || !code.trim()} onPress={() => void join(code)}>加入家庭组</Button></Card.Body></Card>
    {error ? <Card variant="secondary"><Card.Body className="gap-2"><Text type="body-sm" color="danger">{error}</Text><Button size="sm" variant="secondary" onPress={() => void load()}>重试加载</Button></Card.Body></Card> : null}
  </View>;
}
