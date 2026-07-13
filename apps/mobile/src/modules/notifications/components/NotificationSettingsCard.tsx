import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Switch, Text } from '@/ui/hero-runtime';
import type { TestNotificationResult } from '../notification.store';
import type { NotificationPermission } from '../notification.types';

export function NotificationSettingsCard({ permission, taskRemindersEnabled, error, onEnable, onTest, onToggle, onOpenSettings }: {
  permission: NotificationPermission; taskRemindersEnabled: boolean; error: string | null;
  onEnable(): void; onTest(): Promise<TestNotificationResult>; onToggle(enabled: boolean): void; onOpenSettings?(): void;
}) {
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const test = async () => { setTesting(true); const result = await onTest(); setTesting(false); setTestMessage(result.ok ? '测试提醒已发送，将在 3 秒内显示' : result.error); };
  return <Card variant="secondary"><Card.Body className="gap-3"><View className="flex-row items-center justify-between"><View><Card.Title>通知提醒</Card.Title><Card.Description>权限仅在你点击开启时申请</Card.Description></View><Chip color={permission === 'granted' ? 'success' : 'warning'} variant="soft">{permission === 'granted' ? '已允许' : permission === 'denied' ? '已拒绝' : '未询问'}</Chip></View><View className="flex-row items-center justify-between"><Text type="body-sm">任务提醒</Text><Switch isSelected={taskRemindersEnabled} onSelectedChange={onToggle} /></View>{error ? <Text type="body-xs" color="danger">{error}</Text> : null}{testMessage ? <Text type="body-xs" color={testMessage.includes('已发送') ? 'accent' : 'danger'}>{testMessage}</Text> : null}<View className="flex-row flex-wrap gap-2"><Button size="sm" variant="secondary" onPress={onEnable}>开启通知</Button>{permission === 'denied' && onOpenSettings ? <Button size="sm" variant="secondary" onPress={onOpenSettings}>系统设置</Button> : null}<Button size="sm" isDisabled={permission !== 'granted' || testing} onPress={() => void test()}>{testing ? '发送中…' : '发送测试提醒'}</Button></View>{permission !== 'granted' ? <Text type="body-xs" color="muted">通知权限开启后才能发送测试提醒</Text> : null}</Card.Body></Card>;
}
