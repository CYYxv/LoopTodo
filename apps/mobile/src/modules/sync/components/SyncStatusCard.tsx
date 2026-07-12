import { View } from 'react-native';

import { Button, Card, Chip, Text } from '@/ui/hero-runtime';

import type { SyncConflict } from '../sync.types';

export function SyncStatusCard({ configured, pending, conflicts, isSyncing, error, onSync, onResolve }: {
  configured: boolean; pending: number; conflicts: SyncConflict[]; isSyncing: boolean;
  error: string | null; onSync: () => void; onResolve: (id: string, strategy: 'cloud' | 'local') => void;
}) {
  return <Card variant="secondary"><Card.Body className="gap-3"><View className="flex-row items-center justify-between">
    <View><Card.Title>云同步</Card.Title><Card.Description>{configured ? `${pending} 项待上传` : '登录后启用；离线操作已安全保存在本机'}</Card.Description></View>
    {conflicts.length > 0 ? <Chip color="danger" variant="soft">{conflicts.length} 个冲突</Chip> : <Chip color="success" variant="soft">本地可恢复</Chip>}
  </View>{error ? <Text type="body-xs">{error}</Text> : null}
  {conflicts.slice(0, 3).map((conflict) => <View key={conflict.id} className="gap-2"><Text type="body-xs" color="muted">{conflict.entityType} · {conflict.code}</Text><View className="flex-row gap-2"><Button size="sm" variant="secondary" onPress={() => onResolve(conflict.id, 'cloud')}>采用云端</Button><Button size="sm" variant="secondary" onPress={() => onResolve(conflict.id, 'local')}>保留本地重试</Button></View></View>)}
  <Button size="sm" isDisabled={!configured || isSyncing} onPress={onSync}>{isSyncing ? '同步中…' : '立即同步'}</Button>
  </Card.Body></Card>;
}
