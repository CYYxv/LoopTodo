import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Switch, Text } from '@/ui/hero-runtime';

import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { useNotificationStore } from '@/modules/notifications/notification.store';

import { useSettingsStore, type Settings } from '../settings.store';

export function SettingsPanel() {
  const configured = useSettingsStore((state) => state.configured);
  const value = useSettingsStore((state) => state.value);
  const error = useSettingsStore((state) => state.error);
  const load = useSettingsStore((state) => state.load);
  const update = useSettingsStore((state) => state.update);
  const capabilities = useLockEngineStore((state) => state.capabilities);
  const refresh = useLockEngineStore((state) => state.refresh);
  const open = useLockEngineStore((state) => state.open);
  const notificationPermission = useNotificationStore((state) => state.permission);

  useEffect(() => {
    if (configured) void load();
    void refresh();
  }, [configured, load, refresh]);

  const toggle = (key: keyof Settings, next: boolean) => void update({ [key]: next });

  return (
    <View className="gap-3">
      <Card>
        <Card.Body className="gap-3">
          <View className="flex-row justify-between gap-3">
            <Card.Title>账号与隐私</Card.Title>
            <Chip color={configured ? 'success' : 'warning'} variant="soft">
              {configured ? '云端设置' : '登录后同步'}
            </Chip>
          </View>
          <Setting label="多设备同步专注/锁机" value={value?.multiDeviceFocusSync ?? false} onChange={(next) => toggle('multiDeviceFocusSync', next)} />
          <Setting label="启用社交与竞技展示" value={value?.socialEnabled ?? true} onChange={(next) => toggle('socialEnabled', next)} />
          <Setting label="自习室可见当前待办" value={value?.shareCurrentTask ?? false} onChange={(next) => toggle('shareCurrentTask', next)} />
          <Setting label="自习室可见今日完成" value={value?.shareCompletedTasks ?? false} onChange={(next) => toggle('shareCompletedTasks', next)} />
          <Text type="body-xs" color="muted">任务内容默认仅本人可见；家庭任务仅关联家长可见。</Text>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-2">
          <Card.Title>显示</Card.Title>
          <Text type="body-sm">主题跟随系统</Text>
          <Text type="body-xs" color="muted">自动适配浅色和深色模式，并遵循系统字体大小与减少动态效果设置。</Text>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-3">
          <Card.Title>联网策略</Card.Title>
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            <PolicyButton selected={value?.networkPolicy !== 'online_required'} label="离线执行后同步" onPress={() => void update({ networkPolicy: 'offline_first' })} />
            <PolicyButton selected={value?.networkPolicy === 'online_required'} label="要求联网" onPress={() => void update({ networkPolicy: 'online_required' })} />
          </View>
          <Text type="body-xs" color="muted">已开始的锁机始终由本地执行，并在恢复联网后同步。</Text>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-3">
          <Card.Title>通知</Card.Title>
          <Setting label="任务与专注提醒" value={value?.taskRemindersEnabled ?? true} onChange={(next) => toggle('taskRemindersEnabled', next)} />
          <Setting label="家庭异常提醒" value={value?.familyAlertsEnabled ?? true} onChange={(next) => toggle('familyAlertsEnabled', next)} />
          <Setting label="奖励通知" value={value?.rewardNotificationsEnabled ?? true} onChange={(next) => toggle('rewardNotificationsEnabled', next)} />
          <Text type="body-xs">系统通知权限：{notificationPermission}</Text>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-2">
          <Card.Title>锁机权限实时检查</Card.Title>
          <Text type="body-xs">设备：{capabilities?.manufacturer || 'Android'} · API {capabilities?.sdkInt ?? '-'}</Text>
          <Text type="body-xs">通知监听 {yes(capabilities?.notificationListenerEnabled)} · 无障碍 {yes(capabilities?.accessibilityEnabled)} · 电池白名单 {yes(capabilities?.batteryOptimizationIgnored)} · 精确闹钟 {yes(capabilities?.exactAlarmAllowed)}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" onPress={() => void refresh()}>重新检查</Button>
            <Button size="sm" variant="secondary" onPress={() => void open('accessibility')}>无障碍设置</Button>
            <Button size="sm" variant="secondary" onPress={() => void open('notificationListener')}>通知监听</Button>
            <Button size="sm" variant="secondary" onPress={() => void open('vendorBackground')}>厂商后台设置</Button>
          </View>
          <Text type="body-xs" color="muted">请允许自启动、后台运行和后台弹出。厂商设置页不可用时会安全回退到应用详情页。</Text>
        </Card.Body>
      </Card>

      {error ? <Text type="body-xs" accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

function Setting({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View className="flex-row items-center justify-between gap-3"><Text type="body-sm" className="flex-1">{label}</Text><Switch accessibilityLabel={label} isSelected={value} onSelectedChange={onChange} /></View>;
}

function PolicyButton({ selected, label, onPress }: { selected: boolean; label: string; onPress(): void }) {
  return <Button size="sm" variant={selected ? 'primary' : 'secondary'} accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress}>{label}</Button>;
}

function yes(value?: boolean) {
  return value ? '已开启' : '未开启';
}
