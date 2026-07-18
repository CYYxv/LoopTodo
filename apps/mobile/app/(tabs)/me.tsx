import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Avatar } from 'heroui-native/avatar';
import { ListGroup } from 'heroui-native/list-group';
import { Separator } from 'heroui-native/separator';
import { Surface } from 'heroui-native/surface';

import { useAuthStore } from '@/modules/auth/auth.store';
import { Button, Chip, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

const entries = [
  ['/sync', '账号与同步', '设备同步、冲突与手动同步'],
  ['/notifications', '通知与锁机权限', '提醒、通知监听与系统权限'],
  ['/settings', '隐私与权限', '隐私、显示和系统权限'],
  ['/rewards', '奖励', '积分奖励与兑换记录'],
  ['/vip', 'VIP', '订阅状态与权益'],
] as const;

export default function MeRoute() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const displayName = user?.nickname ?? 'LoopTodo 用户';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Screen>
      <PageHeader title="我的" description="管理账号、同步与应用设置" />
      <Surface className="rounded-2xl p-4">
        <View className="flex-row items-center gap-3">
          <Avatar color="accent" variant="soft" size="lg">
            <Avatar.Fallback>{initials}</Avatar.Fallback>
          </Avatar>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text type="h4" weight="semibold" className="flex-shrink">{displayName}</Text>
              <Chip color={user?.vipStatus === 'active' ? 'success' : 'default'} variant="soft">
                {user?.vipStatus === 'active' ? 'VIP' : '免费版'}
              </Chip>
            </View>
            <Text type="body-sm" color="muted">{user?.email}</Text>
          </View>
        </View>
        <Button className="mt-4" size="sm" variant="secondary" onPress={() => void logout()}>退出登录</Button>
      </Surface>

      <View className="gap-2">
        <Text type="body-xs" color="muted" className="px-2">设置与服务</Text>
        <ListGroup>
          {entries.map(([path, title, description], index) => (
            <View key={path}>
              {index > 0 ? <Separator className="mx-4" /> : null}
              <ListGroup.Item accessibilityRole="button" onPress={() => router.push(path)}>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{title}</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>{description}</ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </View>
          ))}
        </ListGroup>
      </View>
    </Screen>
  );
}
