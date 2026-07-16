import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import { formatDuration } from '@/modules/focus-session/focus-session.utils';
import type { Task } from '@/modules/tasks/task.types';
import { ResourcePassPanel } from '@/modules/resource-pass/components/ResourcePassPanel';

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
  const { width } = useWindowDimensions();

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
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={`w-full self-center gap-6 py-8 ${width < 360 ? 'px-3' : 'px-5'}`}
      contentContainerStyle={{ maxWidth: 760 }}
    >
      <View className="gap-5">
        <View className="items-center gap-2"><Chip color="accent" variant="secondary">专注模式 · {modeLabel(session.timerMode)}</Chip><Text type="h2" weight="bold" align="center">{task.title}</Text><Text type="body-sm" color="muted" align="center">进行中状态已写入本机，重启后继续恢复</Text></View>
        <Card><Card.Body className="items-center gap-4 py-8"><Text type="h1" weight="bold">{display}</Text><Text type="body" color="muted" align="center">先完成一个小闭环，再讨论完美不完美。</Text></Card.Body></Card>
        {task.kind === 'goal' ? <TextField><Label>本次完成量（{task.targetUnit}）</Label><Input value={completedAmount} onChangeText={setCompletedAmount} keyboardType="numeric" placeholder="由你填写确认" /></TextField> : null}
      </View>
      <ResourcePassPanel taskId={task.id} readOnly />
      <View className="gap-3"><TextField><Label>{session.mode === 'lock' ? '紧急退出原因' : '退出原因（可选）'}</Label><Input value={exitReason} onChangeText={setExitReason} placeholder={session.mode === 'lock' ? '本月紧急次数有限，请说明原因' : '是什么打断了这次专注？'} />{session.mode === 'focus' ? <Text type="body-xs" color="muted">仅点击“退出专注”时保存为失败复盘。</Text> : null}</TextField><Button variant="primary" size="lg" onPress={() => void onComplete(task.kind === 'goal' ? Number(completedAmount) : undefined)}>完成本次闭环</Button><Button variant="secondary" onPress={() => void onExit(exitReason)}>{session.mode === 'lock' ? '紧急退出锁机' : '退出专注'}</Button></View>
    </ScrollView>
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
