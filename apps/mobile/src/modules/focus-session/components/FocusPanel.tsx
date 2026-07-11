import { View } from 'react-native';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Switch } from 'heroui-native/switch';
import { Text } from 'heroui-native/text';

import type { SessionMode, StrictOption } from '@/modules/focus-session/focus-session.types';
import type { Task } from '@/modules/tasks/task.types';

export function FocusPanel({
  selectedMode,
  strictOptions,
  selectedTask,
  onModeChange,
  onStrictOptionToggle,
  onStart,
}: {
  selectedMode: SessionMode;
  strictOptions: StrictOption[];
  selectedTask: Task | null;
  onModeChange: (mode: SessionMode) => void;
  onStrictOptionToggle: (optionId: string) => void;
  onStart: () => void;
}) {
  return (
    <View className="gap-4">
      <Card>
        <Card.Body className="gap-4">
          <View>
            <Card.Title>选择执行强度</Card.Title>
            <Card.Description>
              专注模式可配置白名单；锁机原生引擎尚未接入，当前不可启动。
            </Card.Description>
          </View>
          <View className="rounded-panel-inner bg-surface-secondary p-3">
            <Text type="body-xs" color="muted">
              当前任务
            </Text>
            <Text type="body-sm" weight="semibold">
              {selectedTask?.title ?? '暂无可执行任务'}
            </Text>
          </View>
          <View className="flex-row gap-3">
            <ModeButton
              isActive={selectedMode === 'focus'}
              label="专注模式"
              description="可退出，可开严格选项"
              onPress={() => onModeChange('focus')}
            />
            <ModeButton
              isActive={selectedMode === 'lock'}
              label="锁机模式"
              description="无白名单，最多 3 小时"
              onPress={() => onModeChange('lock')}
            />
          </View>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-4">
          <View>
            <Card.Title>专注严格选项</Card.Title>
            <Card.Description>锁机模式会忽略白名单，并自动启用最高限制。</Card.Description>
          </View>
          {strictOptions.map((option) => (
            <View key={option.id} className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text type="body-sm" weight="semibold">
                  {option.label}
                </Text>
                <Text type="body-xs" color="muted">
                  {option.description}
                </Text>
              </View>
              <Switch
                isSelected={selectedMode === 'lock' ? true : option.enabled}
                isDisabled={selectedMode === 'lock'}
                onSelectedChange={() => onStrictOptionToggle(option.id)}
              />
            </View>
          ))}
        </Card.Body>
      </Card>

      <ResourcePassPanel />

      <Button
        size="lg"
        variant={selectedMode === 'lock' ? 'danger' : 'primary'}
        isDisabled={!selectedTask || selectedMode === 'lock'}
        onPress={onStart}
      >
        {selectedMode === 'lock' ? '锁机原生能力开发中' : '开始可信专注'}
      </Button>
    </View>
  );
}

function ModeButton({
  isActive,
  label,
  description,
  onPress,
}: {
  isActive: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Button variant={isActive ? 'primary' : 'secondary'} onPress={onPress} className="flex-1">
      <View className="items-center gap-1">
        <Text type="body-sm" weight="semibold">
          {label}
        </Text>
        <Text type="body-xs" color="muted" align="center">
          {description}
        </Text>
      </View>
    </Button>
  );
}

function ResourcePassPanel() {
  const resources = [
    ['受限浏览器', '只允许任务内链接和域名，阻断推荐流与新标签页'],
    ['本地视频播放器', '播放用户事先选择的本地网课文件'],
    ['任务型 AI', '围绕任务材料回答，降低闲聊和发散'],
  ];

  return (
    <Card>
      <Card.Body className="gap-3">
        <View>
          <Card.Title>任务资源通行证</Card.Title>
          <Card.Description>解决“查资料顺手娱乐”的白名单漏洞。</Card.Description>
        </View>
        {resources.map(([title, description]) => (
          <View key={title} className="rounded-panel-inner bg-surface-secondary p-3">
            <Text type="body-sm" weight="semibold">
              {title}
            </Text>
            <Text type="body-xs" color="muted">
              {description}
            </Text>
          </View>
        ))}
      </Card.Body>
    </Card>
  );
}
