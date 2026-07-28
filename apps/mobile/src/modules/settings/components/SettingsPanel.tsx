import { useEffect } from 'react';
import { AppState, View } from 'react-native';

import { Button, Card, Chip, Input, Switch, Text } from '@/ui/hero-runtime';

import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { useNotificationStore } from '@/modules/notifications/notification.store';
import { track } from '@/modules/analytics/analytics';
import { normalizeBottomTabs, optionalTabKeys, replaceBottomTab, tabLabels, type OptionalTabKey } from '@/ui/tab-navigation';

import { useSettingsStore, type Settings, type ThemePreference } from '../settings.store';

const themeOptions: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: '跟随系统', description: '自动匹配设备的浅色或深色外观。' },
  { value: 'light', label: '浅色', description: '始终使用明亮、清爽的界面。' },
  { value: 'dark', label: '深色', description: '始终使用低亮度的深色界面。' },
];

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
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [configured, load, refresh]);

  const bottomTabs = normalizeBottomTabs(value?.bottomTabs);
  const moreTab = optionalTabKeys.find((key) => !bottomTabs.includes(key))!;
  const themePreference = value?.themePreference ?? 'system';
  const activeTheme = themeOptions.find((option) => option.value === themePreference)!;
  const toggle = (key: BooleanSettingKey, next: boolean) => void update({ [key]: next });

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
          <Setting label="未成年人模式" value={value?.isMinor ?? false} onChange={(next) => toggle('isMinor', next)} />
          <View className="gap-1 px-1">
            <Text type="body-xs" color="muted">出生年份（用于年龄保护，未满 18 将自动开启未成年人模式）</Text>
            <Input
              value={value?.birthYear != null ? String(value.birthYear) : ''}
              onChangeText={(raw) => {
                const digits = raw.replace(/\D/g, '').slice(0, 4);
                if (digits.length === 0) {
                  void update({ birthYear: null });
                  return;
                }
                if (digits.length === 4) void update({ birthYear: Number(digits) });
              }}
              keyboardType="number-pad"
              placeholder="例如 2008"
              maxLength={4}
            />
          </View>
          <Setting label="自习室可见当前待办" value={value?.shareCurrentTask ?? false} onChange={(next) => toggle('shareCurrentTask', next)} disabled={value?.isMinor === true} />
          <Setting label="自习室可见今日完成" value={value?.shareCompletedTasks ?? false} onChange={(next) => toggle('shareCompletedTasks', next)} disabled={value?.isMinor === true} />
          <Text type="body-xs" color="muted">任务内容默认仅本人可见；家庭任务仅关联家长可见。</Text>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-3">
          <Card.Title>编辑底部导航</Card.Title>
          <Text type="body-xs" color="muted">任务、我的和更多固定显示；习惯、统计、社交中选择两个放到底栏。</Text>
          {bottomTabs.map((key, index) => (
            <View key={key} className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text type="body-sm" weight="semibold">{tabLabels[key]}</Text>
                <Text type="body-xs" color="muted">底栏第 {index + 2} 个位置</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Button size="sm" variant="secondary" isDisabled={index === 0} onPress={() => void update({ bottomTabs: [bottomTabs[1], bottomTabs[0]] }).then(() => track('nav_customize', { tabs: [bottomTabs[1], bottomTabs[0]] }))}>前移</Button>
                <Button size="sm" variant="secondary" isDisabled={index === 1} onPress={() => void update({ bottomTabs: [bottomTabs[1], bottomTabs[0]] }).then(() => track('nav_customize', { tabs: [bottomTabs[1], bottomTabs[0]] }))}>后移</Button>
                <Button size="sm" variant="secondary" onPress={() => void update({ bottomTabs: replaceBottomTab(bottomTabs, moreTab, index) }).then(() => track('nav_customize', { action: 'to_more', index }))}>移入更多</Button>
              </View>
            </View>
          ))}
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text type="body-sm" weight="semibold">{tabLabels[moreTab]}</Text>
              <Text type="body-xs" color="muted">当前位于更多</Text>
            </View>
            <Button size="sm" onPress={() => void update({ bottomTabs: replaceBottomTab(bottomTabs, moreTab) }).then(() => track('nav_customize', { action: 'to_bottom' }))}>固定到底栏</Button>
          </View>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Card.Title>显示</Card.Title>
              <Text type="body-xs" color="muted">选择应用外观，不影响系统字体大小与减少动态效果设置。</Text>
            </View>
            <Chip color="default" variant="soft">{activeTheme.label}</Chip>
          </View>
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            {themeOptions.map((option) => (
              <Button
                key={option.value}
                className="min-w-0 flex-1"
                size="sm"
                variant={themePreference === option.value ? 'primary' : 'secondary'}
                accessibilityRole="radio"
                accessibilityState={{ selected: themePreference === option.value }}
                onPress={() => void update({ themePreference: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </View>
          <Text type="body-xs" color="muted">{activeTheme.description}</Text>
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
          <Card.Title>专注限制权限</Card.Title>
          <Text type="body-xs">设备：{capabilities?.manufacturer || 'Android'} · API {capabilities?.sdkInt ?? '-'}</Text>
          <Text type="body-xs">使用情况访问 {capabilityStatus(capabilities?.usageAccess?.effective)} · 显示在其他应用上层 {capabilityStatus(capabilities?.overlay?.effective)} · 后台弹出 {capabilityStatus(capabilities?.backgroundLaunch?.effective)}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" onPress={() => void refresh()}>重新检查</Button>
            <Button size="sm" variant="secondary" accessibilityLabel="使用情况访问" onPress={() => void open('usageAccess')}>使用情况访问</Button>
            <Button size="sm" variant="secondary" accessibilityLabel="显示在其他应用上层" onPress={() => void open('overlay')}>显示在其他应用上层</Button>
            <Button size="sm" variant="secondary" onPress={() => void open('vendorBackground')}>厂商后台设置</Button>
          </View>
          <Text type="body-xs" color="muted">软件白名单只使用以上权限，不读取屏幕内容或输入内容。从系统设置返回后会自动重新检查。</Text>
        </Card.Body>
      </Card>

      {error ? <Text type="body-xs" accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

function Setting({ label, value, onChange, disabled }: { label: string; value: boolean; onChange(value: boolean): void; disabled?: boolean }) {
  return <View className="flex-row items-center justify-between gap-3"><Text type="body-sm" className="flex-1" color={disabled ? 'muted' : undefined}>{label}</Text><Switch accessibilityLabel={label} isSelected={value} isDisabled={disabled} onSelectedChange={onChange} /></View>;
}

type BooleanSettingKey = Exclude<keyof Settings, 'bottomTabs' | 'networkPolicy' | 'themePreference'>;

function capabilityStatus(value?: boolean) {
  return value ? '已开启' : '未开启';
}
