import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Text } from 'heroui-native/text';

import type { SessionMode } from '@/modules/focus-session/focus-session.types';
import { formatDuration } from '@/modules/focus-session/focus-session.utils';
import type { Task } from '@/modules/tasks/task.types';

export function ActiveSessionScreen({
  mode,
  task,
  onComplete,
  onExit,
}: {
  mode: SessionMode;
  task: Task;
  onComplete: () => Promise<void>;
  onExit: () => Promise<void>;
}) {
  const isLockMode = mode === 'lock';
  const [remainingSeconds, setRemainingSeconds] = useState(task.estimateMinutes * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remainingSeconds === 0) {
      void onComplete();
    }
  }, [onComplete, remainingSeconds]);

  return (
    <View className="flex-1 justify-between bg-background px-5 py-8">
      <View className="gap-5">
        <View className="items-center gap-2">
          <Chip color={isLockMode ? 'danger' : 'accent'} variant="secondary">
            {isLockMode ? '锁机演示 · 原生能力未接入' : '专注模式 · 可配白名单'}
          </Chip>
          <Text type="h2" weight="bold" align="center">
            {task.title}
          </Text>
          <Text type="body-sm" color="muted" align="center">
            {isLockMode ? '当前版本不会执行系统级锁机' : '开放白名单会降低竞技可信分'}
          </Text>
        </View>

        <Card>
          <Card.Body className="items-center gap-4 py-8">
            <Text type="h1" weight="bold">
              {formatDuration(remainingSeconds)}
            </Text>
            <Text type="body" color="muted" align="center">
              先完成一个小闭环，再讨论完美不完美。
            </Text>
          </Card.Body>
        </Card>

        <View className="gap-3">
          <SessionRule text="显示任务、剩余时间和励志语" />
          <SessionRule
            text={isLockMode ? '只允许 110 / 120 / 119 与拍照' : '严格选项可自由开关'}
          />
          <SessionRule
            text={isLockMode ? '提前退出占用本月紧急机会' : '退出后记录原因并降低可信等级'}
          />
        </View>
      </View>

      <View className="gap-3">
        <Button variant="primary" size="lg" onPress={() => void onComplete()}>
          完成本次闭环
        </Button>
        <Button variant={isLockMode ? 'danger-soft' : 'secondary'} onPress={() => void onExit()}>
          {isLockMode ? '紧急退出（扣分）' : '退出专注'}
        </Button>
      </View>
    </View>
  );
}

function SessionRule({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-panel-inner bg-surface p-3">
      <View className="size-2 rounded-full bg-accent" />
      <Text type="body-sm" className="flex-1">
        {text}
      </Text>
    </View>
  );
}
