import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from 'heroui-native/avatar';
import { ListGroup } from 'heroui-native/list-group';
import { Skeleton } from 'heroui-native/skeleton';
import { Surface } from 'heroui-native/surface';

import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import { useFamilyStore } from '../family.store';
import type { FamilyChildStatus } from '../family.types';

export function FamilyPanel() {
  const [joinOpen, setJoinOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

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

  useEffect(() => {
    if (configured) void load();
  }, [configured, load]);

  useEffect(() => {
    groups.filter((item) => item.role === 'parent').forEach((item) => {
      void loadRequests(item.familyGroup.id);
    });
    if (!childId) {
      const firstChild = groups
        .filter((item) => item.role === 'parent')
        .flatMap((item) => item.familyGroup.members)
        .find((member) => member.role === 'child');
      if (firstChild) setChildId(firstChild.user.id);
    }
  }, [groups, loadRequests, childId]);

  const parentMembership = useMemo(
    () => groups.find((item) => item.role === 'parent') ?? null,
    [groups],
  );

  if (loading && groups.length === 0) {
    return <Skeleton accessibilityLabel="家庭数据加载占位" accessibilityState={{ busy: true }} className="h-40 rounded-2xl" />;
  }

  return (
    <View className="gap-4">
      {groups.length === 0 ? (
        <Surface className="gap-3 rounded-2xl p-4">
          <Text type="body-lg" weight="semibold">家庭</Text>
          <Text type="body-sm" color="muted">创建家庭需要 VIP；使用邀请码加入已有家庭。</Text>
          <Button size="sm" isDisabled={!configured} onPress={() => setJoinOpen(true)}>创建或加入家庭</Button>
        </Surface>
      ) : null}

      {groups.map((membership) => {
        const children = membership.familyGroup.members.filter((member) => member.role === 'child');
        const groupRequests = requests[membership.familyGroup.id] ?? [];
        return (
          <Surface key={membership.id} accessibilityLabel="家庭概览" className="gap-3 rounded-2xl p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <View className="gap-1">
                <Text type="body-lg" weight="semibold">{membership.familyGroup.name}</Text>
                <Text type="body-sm" color="muted">角色：{membership.role === 'parent' ? '家长' : '孩子'}</Text>
              </View>
              <Chip color="accent" variant="soft">{membership.familyGroup.members.length} 人</Chip>
            </View>

            <ListGroup accessibilityLabel="家庭成员" variant="secondary">
              {membership.familyGroup.members.map((member) => (
                <ListGroup.Item key={member.id} disabled>
                  <ListGroup.ItemPrefix>
                    <Avatar color="accent" variant="soft" size="sm">
                      <Avatar.Fallback>{initials(member.user.nickname)}</Avatar.Fallback>
                    </Avatar>
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>{member.user.nickname}</ListGroup.ItemTitle>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <Chip color={member.role === 'parent' ? 'accent' : 'default'} variant="soft">
                      {member.role === 'parent' ? '家长' : '孩子'}
                    </Chip>
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {membership.role === 'parent' ? (
              <View className="gap-3">
                <View className="flex-row flex-wrap gap-2">
                  <Button size="sm" onPress={() => void invite(membership.familyGroup.id, 'child')}>邀请孩子</Button>
                  <Button size="sm" variant="secondary" onPress={() => void invite(membership.familyGroup.id, 'parent')}>邀请家长</Button>
                  <Button size="sm" variant="secondary" onPress={() => { setActiveGroupId(membership.familyGroup.id); setAssignOpen(true); }}>下发任务</Button>
                </View>
                {inviteCode ? <Text type="body-sm">邀请码：{inviteCode}</Text> : null}

                <Text type="body-sm" weight="semibold">选择孩子</Text>
                <View className="flex-row flex-wrap gap-2">
                  {children.length === 0 ? (
                    <Text type="body-xs" color="muted">还没有孩子成员，先发送邀请。</Text>
                  ) : children.map((member) => (
                    <Button key={member.id} size="sm" variant={childId === member.user.id ? 'primary' : 'secondary'} onPress={() => { setChildId(member.user.id); void loadStatus(member.user.id); }}>
                      {member.user.nickname}
                    </Button>
                  ))}
                </View>

                {childStatus && isStatus(childStatus) ? <ChildStatusCard status={childStatus} /> : null}

                {groupRequests.length > 0 ? (
                  <View className="gap-2">
                    <Text type="body-sm" weight="semibold">待处理修改申请</Text>
                    {groupRequests.map((item) => (
                      <Surface key={item.id} variant="secondary" className="gap-2 rounded-xl p-3">
                        <Text type="body-sm">{item.childMember.user.nickname}：{item.assignment.task.title}</Text>
                        <Text type="body-xs" color="muted">{item.reason}</Text>
                        <View className="flex-row gap-2">
                          <Button size="sm" onPress={() => void review(membership.familyGroup.id, item.id, 'approved')}>批准</Button>
                          <Button size="sm" variant="secondary" onPress={() => void review(membership.familyGroup.id, item.id, 'rejected')}>拒绝</Button>
                        </View>
                      </Surface>
                    ))}
                  </View>
                ) : (
                  <Text type="body-xs" color="muted">暂无待处理修改申请</Text>
                )}
              </View>
            ) : null}

            <Button size="sm" variant="danger-soft" onPress={() => void leave(membership.familyGroup.id)}>退出家庭</Button>
          </Surface>
        );
      })}

      {assignments.length > 0 ? (
        <Surface className="gap-3 rounded-2xl p-4">
          <Text type="body-lg" weight="semibold">家长下发的任务</Text>
          {assignments.map((item) => (
            <Surface key={item.id} variant="secondary" className="gap-2 rounded-xl p-3">
              <Text type="body-sm" weight="semibold">{item.task.title}</Text>
              <TextField>
                <Label>申请原因</Label>
                <Input value={reason} onChangeText={setReason} placeholder="说明需要修改或删除的原因" />
              </TextField>
              <View className="flex-row flex-wrap gap-2">
                <Button size="sm" isDisabled={!reason.trim()} onPress={() => void requestChange(item.id, 'update', reason, `${item.task.title}（申请修改）`)}>申请修改</Button>
                <Button size="sm" variant="secondary" isDisabled={!reason.trim()} onPress={() => void requestChange(item.id, 'delete', reason)}>申请删除</Button>
              </View>
            </Surface>
          ))}
        </Surface>
      ) : null}

      {groups.length > 0 ? <Button size="sm" variant="secondary" onPress={() => setJoinOpen(true)}>加入其他家庭</Button> : null}

      {error ? (
        <View className="gap-2">
          <Text type="body-xs" color="danger">{error}</Text>
          <Button size="sm" variant="secondary" onPress={() => void load()}>重试</Button>
        </View>
      ) : null}

      <BottomSheetModal visible={joinOpen} title="创建或加入家庭" onClose={() => setJoinOpen(false)}>
        <TextField><Label>新家庭名称</Label><Input value={name} onChangeText={setName} /></TextField>
        <Button size="sm" isDisabled={!configured || !name.trim()} onPress={() => { void createGroup(name).then(() => { setName(''); setJoinOpen(false); }); }}>创建家庭组</Button>
        <TextField><Label>加入邀请码</Label><Input value={code} onChangeText={setCode} autoCapitalize="characters" /></TextField>
        <Button size="sm" variant="secondary" isDisabled={!configured || !code.trim()} onPress={() => { void join(code).then(() => { setCode(''); setJoinOpen(false); }); }}>加入家庭组</Button>
      </BottomSheetModal>

      <BottomSheetModal visible={assignOpen} title="下发家庭任务" onClose={() => setAssignOpen(false)}>
        {!parentMembership ? (
          <Text type="body-sm" color="muted">仅家长可下发任务</Text>
        ) : (
          <View className="gap-3">
            <Text type="body-sm" weight="semibold">孩子</Text>
            <View className="flex-row flex-wrap gap-2">
              {parentMembership.familyGroup.members.filter((member) => member.role === 'child').map((member) => (
                <Button key={member.id} size="sm" variant={childId === member.user.id ? 'primary' : 'secondary'} onPress={() => setChildId(member.user.id)}>{member.user.nickname}</Button>
              ))}
            </View>
            <TextField><Label>任务名称</Label><Input value={taskTitle} onChangeText={setTaskTitle} /></TextField>
            <View className="flex-row gap-2">
              <Button className="flex-1" size="sm" variant={taskType === 'pomodoro' ? 'primary' : 'secondary'} onPress={() => setTaskType('pomodoro')}>普通任务</Button>
              <Button className="flex-1" size="sm" variant={taskType === 'goal' ? 'primary' : 'secondary'} onPress={() => setTaskType('goal')}>目标任务</Button>
            </View>
            <TextField><Label>专注分钟</Label><Input value={minutes} onChangeText={setMinutes} keyboardType="numeric" /></TextField>
            <TextField><Label>休息分钟</Label><Input value={restMinutes} onChangeText={setRestMinutes} keyboardType="numeric" /></TextField>
            {taskType === 'goal' ? (
              <>
                <TextField><Label>截止日期</Label><Input value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" /></TextField>
                <TextField><Label>目标量</Label><Input value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" /></TextField>
                <TextField><Label>单位</Label><Input value={targetUnit} onChangeText={setTargetUnit} /></TextField>
              </>
            ) : null}
            <Button size="sm" variant={mustDo ? 'danger-soft' : 'secondary'} onPress={() => setMustDo((value) => !value)}>{mustDo ? '今日必须已开启' : '设为今日必须'}</Button>
            {mustDo ? <TextField><Label>强制触发时间</Label><Input value={triggerTime} onChangeText={setTriggerTime} placeholder="HH:mm" /></TextField> : null}
            <Button
              size="sm"
              isDisabled={!childId.trim() || !taskTitle.trim() || Number(minutes) <= 0 || (taskType === 'goal' && (!deadline || Number(targetAmount) <= 0 || !targetUnit.trim())) || (mustDo && !/^\d{2}:\d{2}$/.test(triggerTime))}
              onPress={() => {
                const groupId = activeGroupId ?? parentMembership.familyGroup.id;
                void assign(groupId, {
                  childUserId: childId,
                  title: taskTitle,
                  taskType,
                  timerMode: 'countdown',
                  estimatedMinutes: Number(minutes),
                  restMinutes: Number(restMinutes),
                  deadlineAt: taskType === 'goal' ? new Date(`${deadline}T23:59:59`).toISOString() : undefined,
                  targetAmount: taskType === 'goal' ? Number(targetAmount) : undefined,
                  targetUnit: taskType === 'goal' ? targetUnit : undefined,
                  isTodayRequired: mustDo,
                  triggerTime: mustDo ? triggerTime : undefined,
                }).then(() => { setTaskTitle(''); setAssignOpen(false); });
              }}
            >
              确认下发
            </Button>
          </View>
        )}
      </BottomSheetModal>
    </View>
  );
}

function ChildStatusCard({ status }: { status: FamilyChildStatus }) {
  return (
    <Surface variant="secondary" className="gap-2 rounded-xl p-3" accessibilityLabel="孩子状态">
      <Text type="body-sm" weight="semibold">状态：{status.summary.currentState}</Text>
      <Text type="body-xs" color="muted">任务 {status.summary.taskCount} · 家庭任务 {status.summary.activeFamilyTasks} · 专注记录 {status.summary.sessionCount}</Text>
      {status.familyAssignments.slice(0, 5).map((item) => (
        <Text key={item.id} type="body-xs">· {item.title}{item.isTodayRequired ? ` · 必须 ${item.triggerTime ?? ''}` : ''} · {item.status}</Text>
      ))}
      {(status.recentAnomalies ?? []).length > 0 ? (
        <View className="gap-1">
          <Text type="body-sm" weight="semibold">异常提醒</Text>
          {(status.recentAnomalies ?? []).slice(0, 5).map((item) => (
            <Text key={item.id} type="body-xs" color="danger">· {item.body}</Text>
          ))}
        </View>
      ) : null}
      {status.failures.slice(0, 3).map((item) => (
        <Text key={item.id} type="body-xs" color="danger">失败：{item.reason}（{item.outcome}）</Text>
      ))}
      {status.sessions.slice(0, 3).map((item) => (
        <Text key={item.id} type="body-xs" color="muted">记录：{item.outcome ?? '进行中'} · {item.actualMinutes ?? 0} 分钟{item.completionNote ? ` · ${item.completionNote}` : ''}</Text>
      ))}
    </Surface>
  );
}

function isStatus(value: unknown): value is FamilyChildStatus {
  return Boolean(value && typeof value === 'object' && 'summary' in value && 'familyAssignments' in value);
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'LT';
}
