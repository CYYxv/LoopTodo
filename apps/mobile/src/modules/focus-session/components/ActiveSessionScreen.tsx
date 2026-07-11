import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Text } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import { formatDuration } from '@/modules/focus-session/focus-session.utils';
import type { Task } from '@/modules/tasks/task.types';

export function ActiveSessionScreen({
  session,
  task,
  onComplete,
  onExit,
  onFinishRest,
}: {
  session: ActiveSession;
  task: Task;
  onComplete: (completedAmount?: number) => Promise<void>;
  onExit: (reason?: string) => Promise<void>;
  onFinishRest: () => Promise<void>;
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [completedAmount, setCompletedAmount] = useState('');
  const [exitReason, setExitReason] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const display = timerDisplay(session, currentTime);
  useEffect(() => {
    if (session.phase === 'rest' && session.restEndsAt && session.restEndsAt <= currentTime) {
      void onFinishRest();
    }
  }, [currentTime, onFinishRest, session.phase, session.restEndsAt]);

  if (session.phase === 'rest') {
    return <RestScreen task={task} display={display} onFinishRest={onFinishRest} />;
  }

  return (
    <View className="flex-1 justify-between bg-background px-5 py-8">
      <View className="gap-5">
        <View className="items-center gap-2"><Chip color="accent" variant="secondary">专注模式 · {modeLabel(session.timerMode)}</Chip><Text type="h2" weight="bold" align="center">{task.title}</Text><Text type="body-sm" color="muted" align="center">进行中状态已写入本机，重启后继续恢复</Text></View>
        <Card><Card.Body className="items-center gap-4 py-8"><Text type="h1" weight="bold">{display}</Text><Text type="body" color="muted" align="center">先完成一个小闭环，再讨论完美不完美。</Text></Card.Body></Card>
        {task.kind === 'goal' ? <TextField><Label>本次完成量（{task.targetUnit}）</Label><Input value={completedAmount} onChangeText={setCompletedAmount} keyboardType="numeric" placeholder="由你填写确认" /></TextField> : null}
      </View>
      <View className="gap-3">{session.mode === 'lock' ? <TextField><Label>紧急退出原因</Label><Input value={exitReason} onChangeText={setExitReason} placeholder="本月紧急次数有限，请说明原因" /></TextField> : null}<Button variant="primary" size="lg" onPress={() => void onComplete(task.kind === 'goal' ? Number(completedAmount) : undefined)}>完成本次闭环</Button><Button variant="secondary" onPress={() => void onExit(exitReason)}>{session.mode === 'lock' ? '紧急退出锁机' : '退出专注'}</Button></View>
    </View>
  );
}

function RestScreen({ task, display, onFinishRest }: { task: Task; display: string; onFinishRest: () => Promise<void> }) {
  return <View className="flex-1 justify-between bg-background px-5 py-8"><View className="items-center gap-5"><Chip color="success" variant="soft">自由休息</Chip><Text type="h2" weight="bold" align="center">{task.title} 已记录</Text><Card><Card.Body className="items-center gap-3 py-8"><Text type="h1" weight="bold">{display}</Text><Text type="body-sm" color="muted">休息结束后自动回到待办首页</Text></Card.Body></Card></View><Button onPress={() => void onFinishRest()}>结束休息</Button></View>;
}

function timerDisplay(session: ActiveSession, now: number) {
  if (session.phase === 'rest') return formatDuration(Math.max(0, Math.ceil(((session.restEndsAt ?? now) - now) / 1000)));
  if (session.timerMode === 'untimed') return '不计时';
  if (session.timerMode === 'countup') return formatDuration(Math.max(0, Math.floor((now - session.startedAt) / 1000)));
  return formatDuration(Math.max(0, Math.ceil(((session.plannedEndAt ?? now) - now) / 1000)));
}

function modeLabel(mode: ActiveSession['timerMode']) {
  return { countdown: '倒计时', countup: '正计时', untimed: '不计时' }[mode];
}
