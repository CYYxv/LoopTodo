import { View } from 'react-native';

import { Button, Card, Switch, Text } from '@/ui/hero-runtime';

import type { SessionMode, StrictOption } from '@/modules/focus-session/focus-session.types';
import type { Task } from '@/modules/tasks/task.types';
import type { LockCapabilities } from '@/modules/lock-engine/lock-engine.types';
import { ResourcePassPanel } from '@/modules/resource-pass/components/ResourcePassPanel';

export function FocusPanel({
  selectedMode,
  strictOptions,
  selectedTask,
  onModeChange,
  onStrictOptionToggle,
  onStart,
  lockCapabilities,
  onRefreshLockCapabilities,
  onConfirmLockRisk,
  onOpenLockPermission,
}: {
  selectedMode: SessionMode;
  strictOptions: StrictOption[];
  selectedTask: Task | null;
  onModeChange: (mode: SessionMode) => void;
  onStrictOptionToggle: (optionId: string) => void;
  onStart: () => void;
  lockCapabilities: LockCapabilities | null;
  onRefreshLockCapabilities: () => void;
  onConfirmLockRisk: () => void;
  onOpenLockPermission: (kind: 'notifications' | 'notificationListener' | 'accessibility' | 'battery') => void;
}) {
  return (
    <View className="gap-4">
      <Card>
        <Card.Body className="gap-4">
          <View>
            <Card.Title>选择执行强度</Card.Title>
            <Card.Description>
              专注模式可灵活退出；锁机模式最长 3 小时，并在原生层恢复状态。
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
          <View className="flex-row flex-wrap gap-3">
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
                accessibilityLabel={option.label}
                isSelected={selectedMode === 'lock' ? true : option.enabled}
                isDisabled={selectedMode === 'lock'}
                onSelectedChange={() => onStrictOptionToggle(option.id)}
              />
            </View>
          ))}
        </Card.Body>
      </Card>

      <ResourcePassPanel taskId={selectedTask?.id ?? null} />

      {selectedMode === 'lock' ? <Card variant="secondary"><Card.Body className="gap-3"><Card.Title>锁机权限检查</Card.Title>
        <Text type="body-xs">通知权限：{lockCapabilities?.notificationGranted ? '已开启' : '未开启'}</Text>
        <Text type="body-xs">通知屏蔽：{lockCapabilities?.notificationListenerEnabled ? '已开启' : '未开启'}</Text>
        <Text type="body-xs">增强约束：{lockCapabilities?.accessibilityEnabled ? '已开启' : '未开启（可选）'}</Text>
        <Text type="body-xs">电池优化：{lockCapabilities?.batteryOptimizationIgnored ? '已忽略' : '建议忽略'}</Text>
        <Text type="body-xs">风险确认：{lockCapabilities?.riskConfirmed ? '已确认' : '未确认'}</Text>
        <Text type="body-xs">本月紧急退出：剩余 {lockCapabilities?.emergencyExitsRemaining ?? 0} 次</Text>
        <View className="flex-row flex-wrap gap-2"><Button size="sm" variant="secondary" onPress={onRefreshLockCapabilities}>重新检查</Button>
          {!lockCapabilities?.riskConfirmed ? <Button size="sm" variant="danger" onPress={onConfirmLockRisk}>确认锁机风险</Button> : null}
          {!lockCapabilities?.notificationGranted ? <Button size="sm" variant="secondary" onPress={() => onOpenLockPermission('notifications')}>通知设置</Button> : null}
          {!lockCapabilities?.notificationListenerEnabled ? <Button size="sm" variant="secondary" onPress={() => onOpenLockPermission('notificationListener')}>通知屏蔽</Button> : null}
          {!lockCapabilities?.accessibilityEnabled ? <Button size="sm" variant="secondary" onPress={() => onOpenLockPermission('accessibility')}>增强约束</Button> : null}
          {!lockCapabilities?.batteryOptimizationIgnored ? <Button size="sm" variant="secondary" onPress={() => onOpenLockPermission('battery')}>电池设置</Button> : null}</View>
      </Card.Body></Card> : null}

      <Button
        accessibilityLabel={selectedMode === 'lock' ? '开始锁机' : '开始可信专注'}
        size="lg"
        variant={selectedMode === 'lock' ? 'danger' : 'primary'}
        isDisabled={!selectedTask || (selectedMode === 'lock' && (!lockCapabilities?.notificationGranted || !lockCapabilities.notificationListenerEnabled || !lockCapabilities.riskConfirmed))}
        onPress={onStart}
      >
        {selectedMode === 'lock' ? '开始锁机' : '开始可信专注'}
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
    <Button
      variant={isActive ? 'primary' : 'secondary'}
      onPress={onPress}
      className="min-w-36 flex-1"
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${label}，${description}`}
    >
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
