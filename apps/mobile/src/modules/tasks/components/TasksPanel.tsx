import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Description } from 'heroui-native/description';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Text } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

import type { SessionMode } from '@/modules/focus-session/focus-session.types';
import type { Task, TrustLevel } from '@/modules/tasks/task.types';

const trustCopy: Record<TrustLevel, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  high: { label: '高可信', color: 'success' },
  medium: { label: '普通可信', color: 'warning' },
  low: { label: '开放专注', color: 'danger' },
};

export function TasksPanel({
  tasks,
  draftTitle,
  onDraftTitleChange,
  onCreateTask,
  onStart,
}: {
  tasks: Task[];
  draftTitle: string;
  onDraftTitleChange: (value: string) => void;
  onCreateTask: () => void;
  onStart: (taskId: string, mode: SessionMode) => void;
}) {
  const canCreateTask = draftTitle.trim().length > 0;

  return (
    <View className="gap-4">
      <Card variant="secondary">
        <Card.Body className="gap-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Card.Title>快速添加任务</Card.Title>
              <Card.Description>默认创建 25 分钟普通番茄钟</Card.Description>
            </View>
            <Chip size="sm" variant="soft">
              MVP
            </Chip>
          </View>
          <TextField>
            <Label>任务名</Label>
            <Input
              value={draftTitle}
              onChangeText={onDraftTitleChange}
              placeholder="例如：完成物理作业 P42-P45"
              returnKeyType="done"
              onSubmitEditing={onCreateTask}
            />
            <Description>后续会扩展定目标、截止日期、完成量和强制锁机规则。</Description>
          </TextField>
          <Button isDisabled={!canCreateTask} onPress={onCreateTask}>
            添加到今日待办
          </Button>
        </Card.Body>
      </Card>

      <View className="gap-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onStart={onStart} />
        ))}
      </View>
    </View>
  );
}

function TaskCard({
  task,
  onStart,
}: {
  task: Task;
  onStart: (taskId: string, mode: SessionMode) => void;
}) {
  const trust = trustCopy[task.trustLevel];
  const canStart = task.status === 'pending';

  return (
    <Card>
      <Card.Body className="gap-4">
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <Chip size="sm" color={task.mustDo ? 'danger' : 'default'} variant="secondary">
              {task.mustDo ? '今日必须' : task.category}
            </Chip>
            <Chip size="sm" color={trust.color} variant="soft">
              {trust.label}
            </Chip>
            {task.status === 'completed' ? (
              <Chip size="sm" color="success" variant="soft">
                已完成
              </Chip>
            ) : null}
          </View>
          <Card.Title>{task.title}</Card.Title>
          <Card.Description>{task.progressLabel}</Card.Description>
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <View>
            <Text type="body-sm" color="muted">
              预计时长
            </Text>
            <Text type="h4" weight="semibold">
              {task.estimateMinutes} 分钟
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!canStart}
              accessibilityLabel={`开始${task.title}专注`}
              onPress={() => onStart(task.id, 'focus')}
            >
              专注
            </Button>
            <Button size="sm" variant="danger-soft" isDisabled>
              锁机开发中
            </Button>
          </View>
        </View>
      </Card.Body>
    </Card>
  );
}
