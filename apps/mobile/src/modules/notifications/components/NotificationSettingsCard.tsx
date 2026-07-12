import { View } from 'react-native';
import { Button, Card, Chip, Switch, Text } from '@/ui/hero-runtime';

import type { NotificationPermission } from '../notification.types';

export function NotificationSettingsCard({ permission, taskRemindersEnabled, error, onEnable, onTest, onToggle }: {
  permission: NotificationPermission; taskRemindersEnabled: boolean; error: string | null;
  onEnable: () => void; onTest: () => void; onToggle: (enabled: boolean) => void;
}) {
  return <Card variant="secondary"><Card.Body className="gap-3">
    <View className="flex-row items-center justify-between"><View><Card.Title>通知提醒</Card.Title><Card.Description>权限仅在你点击开启时申请</Card.Description></View>
      <Chip color={permission === 'granted' ? 'success' : 'warning'} variant="soft">{permission === 'granted' ? '已允许' : permission === 'denied' ? '已拒绝' : '未询问'}</Chip></View>
    <View className="flex-row items-center justify-between"><Text type="body-sm">任务提醒</Text><Switch isSelected={taskRemindersEnabled} onSelectedChange={onToggle} /></View>
    {error ? <Text type="body-xs">{error}</Text> : null}
    <View className="flex-row gap-2"><Button size="sm" variant="secondary" onPress={onEnable}>开启通知</Button><Button size="sm" isDisabled={permission !== 'granted'} onPress={onTest}>发送测试提醒</Button></View>
  </Card.Body></Card>;
}
