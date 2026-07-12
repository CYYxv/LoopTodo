import { View } from 'react-native';
import { Button, Card, Chip, Text } from '@/ui/hero-runtime';

import type { LockCapabilities } from '@/modules/lock-engine/lock-engine.types';

export function ForcedTriggerStatusCard({ capabilities, enabledRules, onOpen, onRefresh }: {
  capabilities: LockCapabilities | null; enabledRules: number;
  onOpen: (kind: 'notificationListener' | 'exactAlarm') => void; onRefresh: () => void;
}) {
  if (!enabledRules) return null;
  const ready = Boolean(capabilities?.riskConfirmed && capabilities.notificationGranted && capabilities.notificationListenerEnabled && capabilities.exactAlarmAllowed);
  return <Card variant="secondary"><Card.Body className="gap-3"><View className="flex-row items-center justify-between"><View><Card.Title>强制触发</Card.Title><Card.Description>{enabledRules} 条规则在本机离线执行</Card.Description></View><Chip color={ready ? 'success' : 'danger'} variant="soft">{ready ? '已就绪' : '权限缺失'}</Chip></View>
    <Text type="body-xs">触发前 10 分钟提醒，可延迟 2 次，每次 20 分钟；无操作则进入锁机。</Text>
    <View className="flex-row gap-2"><Button size="sm" variant="secondary" onPress={onRefresh}>重新检查</Button>{!capabilities?.notificationListenerEnabled ? <Button size="sm" variant="secondary" onPress={() => onOpen('notificationListener')}>通知屏蔽</Button> : null}{!capabilities?.exactAlarmAllowed ? <Button size="sm" variant="secondary" onPress={() => onOpen('exactAlarm')}>精确闹钟</Button> : null}</View>
  </Card.Body></Card>;
}
