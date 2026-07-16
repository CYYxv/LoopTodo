import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, Switch, Text } from '@/ui/hero-runtime';

import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { useNotificationStore } from '@/modules/notifications/notification.store';
import { useWhitelistStore } from '@/modules/focus-session/whitelist.store';

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
  const whitelistSelected = useWhitelistStore((state) => state.selected);
  const whitelistApps = useWhitelistStore((state) => state.apps);
  const whitelistLoading = useWhitelistStore((state) => state.loadingApps);
  const hydrateWhitelist = useWhitelistStore((state) => state.hydrate);
  const loadWhitelistApps = useWhitelistStore((state) => state.loadApps);
  const toggleWhitelist = useWhitelistStore((state) => state.toggle);

  useEffect(() => {
    if (configured) void load();
    void refresh();
    void hydrateWhitelist();
  }, [configured, load, refresh, hydrateWhitelist]);

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

      <Card variant="secondary">
        <Card.Body className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Card.Title>专注应用白名单</Card.Title>
            <Chip color={whitelistSelected.length > 0 ? 'success' : 'default'} variant="soft">
              已选 {whitelistSelected.length}
            </Chip>
          </View>
          <Text type="body-xs" color="muted">
            仅用于专注模式的「仅允许任务白名单」严格项：开启后离开 LoopTodo 只允许切换到下方勾选的应用（拨号与相机始终放行）。锁机模式不使用白名单。需先开启无障碍增强约束。
          </Text>
          <Button size="sm" variant="secondary" onPress={() => void loadWhitelistApps()} isDisabled={whitelistLoading}>
            {whitelistLoading ? '正在读取已安装应用…' : whitelistApps.length > 0 ? '刷新已安装应用' : '读取已安装应用'}
          </Button>
          {whitelistApps.length === 0 ? (
            <Text type="body-xs" color="muted">点击上方按钮读取本机可启动的应用列表。</Text>
          ) : (
            <View className="gap-2">
              {whitelistApps.map((app) => (
                <View key={app.packageName} className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text type="body-sm">{app.label}</Text>
                    <Text type="body-xs" color="muted">{app.packageName}</Text>
                  </View>
                  <Switch
                    accessibilityLabel={`允许 ${app.label}`}
                    isSelected={whitelistSelected.includes(app.packageName)}
                    onSelectedChange={() => void toggleWhitelist(app.packageName)}
                  />
                </View>
              ))}
            </View>
          )}
        </Card.Body>
      </Card>

      {error ? <Text type="body-xs" accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

function Setting({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View className="flex-row items-center justify-between gap-3"><Text type="body-sm" className="flex-1">{label}</Text><Switch accessibilityLabel={label} isSelected={value} onSelectedChange={onChange} /></View>;
}

function yes(value?: boolean) {
  return value ? '已开启' : '未开启';
}
