import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/modules/auth/auth.store';
import { Button, Card, Chip, Text } from '@/ui/hero-runtime';
import { PageHeader, Screen } from '@/ui/screen-layout';

const entries = [
  ['/sync', '账号与同步', '设备同步、冲突与手动同步'],
  ['/notifications', '通知与锁机权限', '提醒、通知监听与系统权限'],
  ['/settings', '联网策略与隐私', '隐私、显示和联网规则'],
  ['/social', '社交与战队', '好友 PK、自习室和竞赛'],
  ['/family', '家庭', '家庭组、家长任务和修改申请'],
  ['/rewards', '奖励', '积分奖励与兑换记录'],
  ['/vip', 'VIP', '订阅状态与权益'],
] as const;

export default function MeRoute() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  return <Screen><PageHeader title="我的" description="账号、同步、权限和扩展功能集中在这里。" /><Card><Card.Body className="gap-3"><View className="flex-row items-center justify-between gap-3"><View className="flex-1"><Card.Title>{user?.nickname ?? 'LoopTodo 用户'}</Card.Title><Card.Description>{user?.email}</Card.Description></View><Chip color={user?.vipStatus === 'active' ? 'success' : 'default'}>{user?.vipStatus === 'active' ? 'VIP' : '免费版'}</Chip></View><Button size="sm" variant="secondary" onPress={() => void logout()}>退出登录</Button></Card.Body></Card><Card><View>{entries.map(([path, title, description], index) => <Pressable key={path} accessibilityRole="button" onPress={() => router.push(path)} style={[styles.row, index > 0 && styles.divider]}><View style={styles.copy}><Text type="body-sm" weight="semibold">{title}</Text><Text type="body-xs" color="muted">{description}</Text></View><Text type="h4" color="muted">›</Text></Pressable>)}</View></Card></Screen>;
}

const styles = StyleSheet.create({ row: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D4D4D4' }, copy: { flex: 1, gap: 3 } });
