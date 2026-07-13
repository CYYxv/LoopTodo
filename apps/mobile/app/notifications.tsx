import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { NotificationSettingsCard } from '@/modules/notifications/components/NotificationSettingsCard';
import { useNotificationStore } from '@/modules/notifications/notification.store';
import { ForcedTriggerStatusCard } from '@/modules/forced-trigger/components/ForcedTriggerStatusCard';
import { useHabitStore } from '@/modules/habits/habit.store';
import { useLockEngineStore } from '@/modules/lock-engine/lock-engine.store';
import { Button } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

export default function NotificationsRoute() {
  const router = useRouter();
  const permission = useNotificationStore((state) => state.permission); const enabled = useNotificationStore((state) => state.taskRemindersEnabled); const error = useNotificationStore((state) => state.error); const hydrate = useNotificationStore((state) => state.hydrate); const enable = useNotificationStore((state) => state.enableNotifications); const test = useNotificationStore((state) => state.sendTestReminder); const toggle = useNotificationStore((state) => state.setTaskRemindersEnabled);
  const capabilities = useLockEngineStore((state) => state.capabilities); const refresh = useLockEngineStore((state) => state.refresh); const open = useLockEngineStore((state) => state.open); const habits = useHabitStore((state) => state.habits);
  useEffect(() => { void hydrate(); void refresh(); }, [hydrate, refresh]);
  return <Screen><PageHeader title="通知与锁机权限" description="仅在你主动操作时请求系统权限。" action={<Button size="sm" variant="secondary" onPress={() => router.back()}>返回</Button>} /><NotificationSettingsCard permission={permission} taskRemindersEnabled={enabled} error={error} onEnable={() => void enable()} onTest={test} onToggle={(value) => void toggle(value)} onOpenSettings={() => void open('notifications')} /><ForcedTriggerStatusCard capabilities={capabilities} enabledRules={habits.filter((habit) => habit.forceEnabled).length} onRefresh={() => void refresh()} onOpen={(kind) => void open(kind)} /></Screen>;
}
