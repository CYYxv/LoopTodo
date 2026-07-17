import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { useTaskStore } from '@/modules/tasks/task.store';
import { Text } from '@/ui/hero-runtime';
import { formatDuration, sessionTimerSeconds } from '../focus-session.utils';
import type { ActiveSession } from '../focus-session.types';

export function ActiveSessionBar() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const session = useTaskStore((state) => state.activeSession);
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === state.activeSession?.taskId) ?? null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);
  if (!session || !task) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="返回当前计时" onPress={() => router.push('/session')} style={[styles.bar, dark && styles.barDark]}><View style={styles.copy}><Text type="body-xs" color="muted">{session.phase === 'rest' ? '休息中' : session.pausedAt != null ? '已暂停' : session.mode === 'lock' ? '锁机专注中' : '专注中'}</Text><Text type="body-sm" weight="semibold" numberOfLines={1}>{task.title}</Text></View><Text type="body-sm" weight="bold" color="accent">{sessionTime(session, now)}</Text></Pressable>;
}

function sessionTime(session: ActiveSession, now: number) {
  const seconds = sessionTimerSeconds(session, now);
  return seconds == null ? '进行中' : formatDuration(seconds);
}

const styles = StyleSheet.create({ bar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D4D4D4', backgroundColor: '#EFF6FF' }, barDark: { borderTopColor: '#383B42', backgroundColor: '#202938' }, copy: { flex: 1, gap: 1 } });
