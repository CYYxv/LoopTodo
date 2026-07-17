import { useEffect, useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import { BottomSheetModal } from '@/ui/bottom-sheet-modal';
import { Button, Card, Chip, Input, Label, Text, TextField } from '@/ui/hero-runtime';

import type { ActiveSession } from '@/modules/focus-session/focus-session.types';
import { formatDuration, sessionTimerSeconds } from '@/modules/focus-session/focus-session.utils';
import type { Task } from '@/modules/tasks/task.types';

const keepAwakeTag = 'looptodo-active-session';

export function ActiveSessionScreen({
  session,
  task,
  error,
  isPausePending = false,
  onTogglePause,
  onComplete,
  onExit,
  onFinishRest,
}: {
  session: ActiveSession;
  task: Task;
  error: string | null;
  isPausePending?: boolean;
  onTogglePause: () => Promise<void>;
  onComplete: (completedAmount?: number, completionNote?: string) => Promise<void>;
  onExit: (reason?: string) => Promise<void>;
  onFinishRest: () => Promise<void>;
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [completedAmount, setCompletedAmount] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [finishOpen, setFinishOpen] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timerSeconds = sessionTimerSeconds(session, currentTime);
  useEffect(() => {
    if (session.phase === 'rest' && session.restEndsAt && session.restEndsAt <= currentTime) void onFinishRest();
  }, [currentTime, onFinishRest, session.phase, session.restEndsAt]);

  if (session.phase === 'rest') {
    return <RestScreen task={task} display={formatDuration(timerSeconds ?? 0)} onFinishRest={onFinishRest} />;
  }

  const ringSize = Math.min(Math.max(width - 72, 240), 320);
  const paused = session.pausedAt != null;
  return <View className="flex-1 bg-background">
    {keepAwake ? <KeepAwakeActive /> : null}
    <View style={styles.header}>
      <View style={styles.headerSpacer} />
      <IconButton label={keepAwake ? '关闭屏幕常亮' : '开启屏幕常亮'} selected={keepAwake}
        onPress={() => setKeepAwake((value) => !value)}><SunIcon active={keepAwake} /></IconButton>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.timerSection}>
        <TimerRing session={session} task={task} now={currentTime} size={ringSize} />
        <Text type="h3" weight="semibold" align="center" numberOfLines={2}>{task.title}</Text>
      </View>
      <View style={styles.controls}>
        <IconButton label={session.mode === 'lock' ? '锁机模式不可暂停' : paused ? '继续专注' : '暂停专注'}
          primary selected={paused} disabled={session.mode === 'lock' || isPausePending} onPress={() => void onTogglePause()}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </IconButton>
        <IconButton label="结束专注" danger disabled={isPausePending} onPress={() => setFinishOpen(true)}><StopIcon /></IconButton>
      </View>
      {error ? <Text type="body-sm" color="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
    </ScrollView>
    <BottomSheetModal visible={finishOpen} title="结束专注" onClose={() => setFinishOpen(false)}>
      {task.kind === 'goal' ? <TextField><Label>本次完成量（{task.targetUnit}）</Label><Input value={completedAmount} onChangeText={setCompletedAmount} keyboardType="numeric" placeholder="由你填写确认" /></TextField> : null}
      <TextField><Label>本次完成内容</Label><Input accessibilityLabel="本次完成内容" value={completionNote} onChangeText={setCompletionNote} placeholder="例如：完成第一章练习并订正错题" /></TextField>
      <TextField><Label>{session.mode === 'lock' ? '紧急退出原因' : '退出原因（可选）'}</Label><Input value={exitReason} onChangeText={setExitReason} placeholder={session.mode === 'lock' ? '请说明紧急退出原因' : '是什么打断了这次专注？'} /></TextField>
      {error ? <Text type="body-sm" color="danger" accessibilityRole="alert">{error}</Text> : null}
      <Button size="lg" onPress={() => void onComplete(task.kind === 'goal' ? Number(completedAmount) : undefined, completionNote)}>完成专注</Button>
      <Button variant={session.mode === 'lock' ? 'danger' : 'secondary'} onPress={() => void onExit(exitReason)}>{session.mode === 'lock' ? '紧急退出锁机' : '放弃本次专注'}</Button>
    </BottomSheetModal>
  </View>;
}

function KeepAwakeActive() {
  useKeepAwake(keepAwakeTag);
  return null;
}

function TimerRing({ session, task, now, size }: { session: ActiveSession; task: Task; now: number; size: number }) {
  const dark = useColorScheme() === 'dark';
  const seconds = sessionTimerSeconds(session, now);
  const totalSeconds = Math.max(1, task.estimateMinutes * 60);
  const progress = session.timerMode === 'countdown'
    ? Math.min(1, (seconds ?? totalSeconds) / totalSeconds)
    : session.timerMode === 'countup'
      ? Math.min(1, (seconds ?? 0) / totalSeconds)
      : 1;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const accent = session.pausedAt == null ? '#2563EB' : dark ? '#737A86' : '#A3A3A3';
  return <View testID="focus-timer-ring" style={{ width: size, height: size }}>
    <Svg width={size} height={size} style={styles.ringSvg}>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={dark ? '#30343B' : '#E5E7EB'} strokeWidth={strokeWidth} />
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={accent} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - progress)} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
    </Svg>
    <View style={styles.timerValue}>
      <Text type="h1" weight="bold" align="center" adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1}
        style={{ fontSize: Math.min(58, size * 0.2), lineHeight: Math.min(68, size * 0.23) }}>
        {seconds == null ? '进行中' : formatDuration(seconds)}
      </Text>
    </View>
  </View>;
}

function IconButton({ label, selected = false, primary = false, danger = false, disabled = false, onPress, children }: {
  label: string; selected?: boolean; primary?: boolean; danger?: boolean; disabled?: boolean; onPress(): void; children: React.ReactNode;
}) {
  const dark = useColorScheme() === 'dark';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled}
    hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.iconButton,
      primary && styles.iconButtonPrimary, danger && styles.iconButtonDanger,
      !primary && !danger && (dark ? styles.iconButtonDark : styles.iconButtonLight),
      selected && !primary && styles.iconButtonSelected, disabled && styles.iconButtonDisabled, pressed && !disabled && styles.pressed]}>
    {children}
  </Pressable>;
}

function SunIcon({ active }: { active: boolean }) { const dark = useColorScheme() === 'dark'; return <Svg width={27} height={27} viewBox="0 0 24 24" fill="none" stroke={active ? '#F59E0B' : dark ? '#8F949E' : '#737373'} strokeWidth={2}><Circle cx={12} cy={12} r={4} /><Path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" /></Svg>; }
function PlayIcon() { return <Svg width={31} height={31} viewBox="0 0 24 24" fill="#FFFFFF"><Polygon points="8,5 19,12 8,19" /></Svg>; }
function PauseIcon() { return <Svg width={31} height={31} viewBox="0 0 24 24" fill="#FFFFFF"><Rect x={6} y={5} width={4} height={14} rx={1} /><Rect x={14} y={5} width={4} height={14} rx={1} /></Svg>; }
function StopIcon() { return <Svg width={25} height={25} viewBox="0 0 24 24" fill="#FFFFFF"><Rect x={5} y={5} width={14} height={14} rx={2.5} /></Svg>; }

function RestScreen({ task, display, onFinishRest }: { task: Task; display: string; onFinishRest: () => Promise<void> }) {
  return <View className="flex-1 justify-between bg-background px-5 py-8"><View className="items-center gap-5"><Chip color="success" variant="soft">自由休息</Chip><Text type="h2" weight="bold" align="center">{task.title} 已记录</Text><Card><Card.Body className="items-center gap-3 py-8"><Text type="h1" weight="bold">{display}</Text><Text type="body-sm" color="muted">休息结束后自动回到待办首页</Text></Card.Body></Card></View><Button onPress={() => void onFinishRest()}>结束休息</Button></View>;
}

const styles = StyleSheet.create({
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  headerSpacer: { width: 48, height: 48 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 38, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 },
  timerSection: { alignItems: 'center', gap: 22 },
  ringSvg: { position: 'absolute', top: 0, left: 0 },
  timerValue: { position: 'absolute', top: 0, right: 22, bottom: 0, left: 22, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  iconButton: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  iconButtonPrimary: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563EB' },
  iconButtonDanger: { backgroundColor: '#DC2626' },
  iconButtonLight: { backgroundColor: '#F1F1F1' },
  iconButtonDark: { backgroundColor: '#30343B' },
  iconButtonSelected: { borderWidth: 2, borderColor: '#F59E0B' },
  iconButtonDisabled: { opacity: 0.38 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
});
