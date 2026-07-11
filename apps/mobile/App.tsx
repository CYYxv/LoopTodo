import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Chip } from 'heroui-native/chip';
import { Description } from 'heroui-native/description';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { Switch } from 'heroui-native/switch';
import { Text } from 'heroui-native/text';
import { TextField } from 'heroui-native/text-field';

type PanelKey = 'tasks' | 'focus' | 'social' | 'family';
type SessionMode = 'focus' | 'lock';
type TaskKind = 'pomodoro' | 'goal';
type TrustLevel = 'high' | 'medium' | 'low';
type TaskStatus = 'pending' | 'completed';
type SessionOutcome = 'completed' | 'exited';

type Task = {
  id: number;
  title: string;
  category: string;
  kind: TaskKind;
  estimateMinutes: number;
  progressLabel: string;
  mustDo: boolean;
  trustLevel: TrustLevel;
  status: TaskStatus;
};

type ActiveSession = {
  taskId: number;
  mode: SessionMode;
  startedAt: number;
};

type FocusSessionRecord = ActiveSession & {
  id: number;
  endedAt: number;
  outcome: SessionOutcome;
  failureReason: string | null;
};

type StrictOption = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

const initialTasks: Task[] = [
  {
    id: 1,
    title: '数学套卷错题复盘',
    category: '学习',
    kind: 'goal',
    estimateMinutes: 50,
    progressLabel: '目标 2 套 / 已完成 0.5 套',
    mustDo: true,
    trustLevel: 'high',
    status: 'pending',
  },
  {
    id: 2,
    title: '整理周报素材',
    category: '办公',
    kind: 'pomodoro',
    estimateMinutes: 35,
    progressLabel: '普通番茄钟 · 倒计时',
    mustDo: false,
    trustLevel: 'medium',
    status: 'pending',
  },
  {
    id: 3,
    title: '英语听力精听',
    category: '习惯',
    kind: 'pomodoro',
    estimateMinutes: 25,
    progressLabel: '本地音频资源通行证',
    mustDo: true,
    trustLevel: 'high',
    status: 'pending',
  },
];

const panelLabels: Record<PanelKey, string> = {
  tasks: '待办',
  focus: '专注',
  social: '战队',
  family: '家庭',
};

const trustCopy: Record<TrustLevel, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  high: { label: '高可信', color: 'success' },
  medium: { label: '普通可信', color: 'warning' },
  low: { label: '开放专注', color: 'danger' },
};

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelKey>('tasks');
  const [selectedMode, setSelectedMode] = useState<SessionMode>('focus');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0]?.id ?? null);
  const [sessionRecords, setSessionRecords] = useState<FocusSessionRecord[]>([]);
  const isFinishingSession = useRef(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [strictOptions, setStrictOptions] = useState<StrictOption[]>([
    {
      id: 'whitelist',
      label: '只允许任务白名单',
      description: '浏览器、B 站、AI 等高风险应用会降低可信分',
      enabled: true,
    },
    {
      id: 'notification',
      label: '拦截通知',
      description: '专注期间不让消息流把注意力拉走',
      enabled: true,
    },
    {
      id: 'recents',
      label: '隐藏多任务与桌面图标',
      description: '降低被手动杀进程或卸载绕过的概率',
      enabled: false,
    },
  ]);

  const todayMinutes = useMemo(
    () =>
      tasks.reduce(
        (total, task) => total + (task.status === 'pending' ? task.estimateMinutes : 0),
        0
      ),
    [tasks]
  );

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId && task.status === 'pending') ??
    tasks.find((task) => task.status === 'pending') ??
    null;
  const activeTask = activeSession
    ? tasks.find((task) => task.id === activeSession.taskId) ?? null
    : null;
  const canCreateTask = draftTitle.trim().length > 0;

  const createTask = () => {
    if (!canCreateTask) {
      return;
    }

    setTasks((currentTasks) => [
      {
        id: Date.now(),
        title: draftTitle.trim(),
        category: '收集箱',
        kind: 'pomodoro',
        estimateMinutes: 25,
        progressLabel: '普通番茄钟 · 默认 25 分钟',
        mustDo: false,
        trustLevel: 'medium',
        status: 'pending',
      },
      ...currentTasks,
    ]);
    setDraftTitle('');
    setActivePanel('tasks');
  };

  const toggleStrictOption = (optionId: string) => {
    setStrictOptions((currentOptions) =>
      currentOptions.map((option) =>
        option.id === optionId ? { ...option, enabled: !option.enabled } : option
      )
    );
  };

  const startSession = (taskId: number, mode: SessionMode) => {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task || task.status !== 'pending' || mode === 'lock') {
      return;
    }

    setSelectedTaskId(taskId);
    setSelectedMode(mode);
    isFinishingSession.current = false;
    setActiveSession({ taskId, mode, startedAt: Date.now() });
  };

  const finishSession = (outcome: SessionOutcome) => {
    if (!activeSession || isFinishingSession.current) {
      return;
    }

    isFinishingSession.current = true;

    if (outcome === 'completed') {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === activeSession.taskId ? { ...task, status: 'completed' } : task
        )
      );
    }

    setSessionRecords((currentRecords) => [
      {
        ...activeSession,
        id: Date.now(),
        endedAt: Date.now(),
        outcome,
        failureReason: outcome === 'exited' ? '用户主动退出专注' : null,
      },
      ...currentRecords,
    ]);
    setActiveSession(null);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <HeroUINativeProvider>
        <SafeAreaView style={styles.root}>
          <View className="flex-1 bg-background">
            <StatusBar style="dark" />
            {activeSession && activeTask ? (
              <ActiveSessionScreen
                mode={activeSession.mode}
                task={activeTask}
                onComplete={() => finishSession('completed')}
                onExit={() => finishSession('exited')}
              />
            ) : (
              <ScrollView
                className="flex-1"
                contentContainerClassName="gap-5 px-5 pb-8 pt-4"
                showsVerticalScrollIndicator={false}
              >
                <Header />
                <DashboardSummary
                  todayMinutes={todayMinutes}
                  completedSessions={sessionRecords.filter(
                    (record) => record.outcome === 'completed'
                  ).length}
                />
                <PanelTabs activePanel={activePanel} onPanelChange={setActivePanel} />
                {activePanel === 'tasks' ? (
                  <TasksPanel
                    tasks={tasks}
                    draftTitle={draftTitle}
                    canCreateTask={canCreateTask}
                    onDraftTitleChange={setDraftTitle}
                    onCreateTask={createTask}
                    onStart={startSession}
                  />
                ) : null}
                {activePanel === 'focus' ? (
                  <FocusPanel
                    selectedMode={selectedMode}
                    strictOptions={strictOptions}
                    onModeChange={setSelectedMode}
                    onStrictOptionToggle={toggleStrictOption}
                    selectedTask={selectedTask}
                    onStart={() => {
                      if (selectedTask) {
                        startSession(selectedTask.id, selectedMode);
                      }
                    }}
                  />
                ) : null}
                {activePanel === 'social' ? <SocialPanel /> : null}
                {activePanel === 'family' ? <FamilyPanel /> : null}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

function Header() {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View>
          <Text type="h2" weight="bold">
            LoopTodo
          </Text>
          <Text type="body-sm" color="muted">
            LoopTodo · 把任务推进到完成
          </Text>
        </View>
        <Chip variant="secondary" color="accent">
          <Chip.Label>黄金 III</Chip.Label>
        </Chip>
      </View>
      <Text type="body-sm" color="muted">
        今天的原则：该做事时进入闭环，该玩时安心玩。
      </Text>
    </View>
  );
}

function DashboardSummary({
  todayMinutes,
  completedSessions,
}: {
  todayMinutes: number;
  completedSessions: number;
}) {
  return (
    <View className="flex-row gap-3">
      <MetricCard label="今日计划" value={`${todayMinutes}m`} />
      <MetricCard label="完成闭环" value={`${completedSessions} 次`} />
      <MetricCard label="紧急退出" value="2/2" />
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1">
      <Card.Body className="gap-1">
        <Text type="body-xs" color="muted">
          {label}
        </Text>
        <Text type="h4" weight="bold">
          {value}
        </Text>
      </Card.Body>
    </Card>
  );
}

function PanelTabs({
  activePanel,
  onPanelChange,
}: {
  activePanel: PanelKey;
  onPanelChange: (panel: PanelKey) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {(Object.keys(panelLabels) as PanelKey[]).map((panel) => (
        <Button
          key={panel}
          size="sm"
          variant={activePanel === panel ? 'primary' : 'secondary'}
          onPress={() => onPanelChange(panel)}
          className="flex-1"
        >
          {panelLabels[panel]}
        </Button>
      ))}
    </View>
  );
}

function TasksPanel({
  tasks,
  draftTitle,
  canCreateTask,
  onDraftTitleChange,
  onCreateTask,
  onStart,
}: {
  tasks: Task[];
  draftTitle: string;
  canCreateTask: boolean;
  onDraftTitleChange: (value: string) => void;
  onCreateTask: () => void;
  onStart: (taskId: number, mode: SessionMode) => void;
}) {
  return (
    <View className="gap-4">
      <Card variant="secondary">
        <Card.Body className="gap-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Card.Title>快速添加任务</Card.Title>
              <Card.Description>默认创建 25 分钟普通番茄钟</Card.Description>
            </View>
            <Chip size="sm" variant="soft">
              MVP
            </Chip>
          </View>
          <TextField>
            <Label>任务名</Label>
            <Input
              value={draftTitle}
              onChangeText={onDraftTitleChange}
              placeholder="例如：完成物理作业 P42-P45"
              returnKeyType="done"
              onSubmitEditing={onCreateTask}
            />
            <Description>后续会扩展定目标、截止日期、完成量和强制锁机规则。</Description>
          </TextField>
          <Button isDisabled={!canCreateTask} onPress={onCreateTask}>
            添加到今日待办
          </Button>
        </Card.Body>
      </Card>

      <View className="gap-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onStart={onStart} />
        ))}
      </View>
    </View>
  );
}

function TaskCard({
  task,
  onStart,
}: {
  task: Task;
  onStart: (taskId: number, mode: SessionMode) => void;
}) {
  const trust = trustCopy[task.trustLevel];

  return (
    <Card>
      <Card.Body className="gap-4">
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <Chip size="sm" color={task.mustDo ? 'danger' : 'default'} variant="secondary">
              {task.mustDo ? '今日必须' : task.category}
            </Chip>
            <Chip size="sm" color={trust.color} variant="soft">
              {trust.label}
            </Chip>
            {task.status === 'completed' ? (
              <Chip size="sm" color="success" variant="soft">
                已完成
              </Chip>
            ) : null}
          </View>
          <Card.Title>{task.title}</Card.Title>
          <Card.Description>{task.progressLabel}</Card.Description>
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <View>
            <Text type="body-sm" color="muted">
              预计时长
            </Text>
            <Text type="h4" weight="semibold">
              {task.estimateMinutes} 分钟
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={task.status === 'completed'}
              onPress={() => onStart(task.id, 'focus')}
            >
              专注
            </Button>
            <Button size="sm" variant="danger-soft" isDisabled>
              锁机开发中
            </Button>
          </View>
        </View>
      </Card.Body>
    </Card>
  );
}

function FocusPanel({
  selectedMode,
  strictOptions,
  onModeChange,
  onStrictOptionToggle,
  selectedTask,
  onStart,
}: {
  selectedMode: SessionMode;
  strictOptions: StrictOption[];
  onModeChange: (mode: SessionMode) => void;
  onStrictOptionToggle: (optionId: string) => void;
  selectedTask: Task | null;
  onStart: () => void;
}) {
  return (
    <View className="gap-4">
      <Card>
        <Card.Body className="gap-4">
          <View>
            <Card.Title>选择执行强度</Card.Title>
            <Card.Description>
              专注模式可配置白名单；锁机原生引擎尚未接入，当前不可启动。
            </Card.Description>
          </View>
          <View className="rounded-panel-inner bg-surface-secondary p-3">
            <Text type="body-xs" color="muted">
              当前任务
            </Text>
            <Text type="body-sm" weight="semibold">
              {selectedTask?.title ?? '暂无可执行任务'}
            </Text>
          </View>
          <View className="flex-row gap-3">
            <ModeButton
              isActive={selectedMode === 'focus'}
              label="专注模式"
              description="可退出，可开严格选项"
              onPress={() => onModeChange('focus')}
            />
            <ModeButton
              isActive={selectedMode === 'lock'}
              label="锁机模式"
              description="无白名单，最多 3 小时"
              onPress={() => onModeChange('lock')}
            />
          </View>
        </Card.Body>
      </Card>

      <Card variant="secondary">
        <Card.Body className="gap-4">
          <View>
            <Card.Title>专注严格选项</Card.Title>
            <Card.Description>锁机模式会忽略白名单，并自动启用最高限制。</Card.Description>
          </View>
          {strictOptions.map((option) => (
            <View key={option.id} className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text type="body-sm" weight="semibold">
                  {option.label}
                </Text>
                <Text type="body-xs" color="muted">
                  {option.description}
                </Text>
              </View>
              <Switch
                isSelected={selectedMode === 'lock' ? true : option.enabled}
                isDisabled={selectedMode === 'lock'}
                onSelectedChange={() => onStrictOptionToggle(option.id)}
              />
            </View>
          ))}
        </Card.Body>
      </Card>

      <ResourcePassPanel />

      <Button
        size="lg"
        variant={selectedMode === 'lock' ? 'danger' : 'primary'}
        isDisabled={!selectedTask || selectedMode === 'lock'}
        onPress={onStart}
      >
        {selectedMode === 'lock' ? '锁机原生能力开发中' : '开始可信专注'}
      </Button>
    </View>
  );
}

function ModeButton({
  isActive,
  label,
  description,
  onPress,
}: {
  isActive: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Button
      variant={isActive ? 'primary' : 'secondary'}
      onPress={onPress}
      className="flex-1"
    >
      <View className="items-center gap-1">
        <Text type="body-sm" weight="semibold">
          {label}
        </Text>
        <Text type="body-xs" color="muted" align="center">
          {description}
        </Text>
      </View>
    </Button>
  );
}

function ResourcePassPanel() {
  const resources = [
    ['受限浏览器', '只允许任务内链接和域名，阻断推荐流与新标签页'],
    ['本地视频播放器', '播放用户事先选择的本地网课文件'],
    ['任务型 AI', '围绕任务材料回答，降低闲聊和发散'],
  ];

  return (
    <Card>
      <Card.Body className="gap-3">
        <View>
          <Card.Title>任务资源通行证</Card.Title>
          <Card.Description>解决“查资料顺手娱乐”的白名单漏洞。</Card.Description>
        </View>
        {resources.map(([title, description]) => (
          <View key={title} className="rounded-panel-inner bg-surface-secondary p-3">
            <Text type="body-sm" weight="semibold">
              {title}
            </Text>
            <Text type="body-xs" color="muted">
              {description}
            </Text>
          </View>
        ))}
      </Card.Body>
    </Card>
  );
}

function SocialPanel() {
  return (
    <View className="gap-4">
      <Card>
        <Card.Body className="gap-3">
          <Chip size="sm" color="accent" variant="soft">
            S1 赛季 · 还剩 164 天
          </Chip>
          <Card.Title>好友 PK 与战队冲榜</Card.Title>
          <Card.Description>
            当前原型先固定展示赛季、段位、队伍分。后续接入房间、邀请码和排行榜。
          </Card.Description>
          <View className="flex-row gap-3">
            <MetricCard label="个人积分" value="1,284" />
            <MetricCard label="战队人均" value="92m" />
          </View>
          <Button variant="secondary" isDisabled>
            自习室开发中
          </Button>
        </Card.Body>
      </Card>
    </View>
  );
}

function FamilyPanel() {
  return (
    <Card>
      <Card.Body className="gap-3">
        <Chip size="sm" color="warning" variant="soft">
          家庭组
        </Chip>
        <Card.Title>家长任务与申请修改</Card.Title>
        <Card.Description>
          家长可下发任务和规则，孩子不能直接改删，只能申请修改；家长不能实时远程一键锁机。
        </Card.Description>
        <Button variant="secondary" isDisabled>
          家庭功能开发中
        </Button>
      </Card.Body>
    </Card>
  );
}

function ActiveSessionScreen({
  mode,
  task,
  onComplete,
  onExit,
}: {
  mode: SessionMode;
  task: Task;
  onComplete: () => void;
  onExit: () => void;
}) {
  const isLockMode = mode === 'lock';
  const [remainingSeconds, setRemainingSeconds] = useState(task.estimateMinutes * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remainingSeconds === 0) {
      onComplete();
    }
  }, [onComplete, remainingSeconds]);

  return (
    <View className="flex-1 justify-between bg-background px-5 py-8">
      <View className="gap-5">
        <View className="items-center gap-2">
          <Chip color={isLockMode ? 'danger' : 'accent'} variant="secondary">
            {isLockMode ? '锁机演示 · 原生能力未接入' : '专注模式 · 可配白名单'}
          </Chip>
          <Text type="h2" weight="bold" align="center">
            {task.title}
          </Text>
          <Text type="body-sm" color="muted" align="center">
            {isLockMode ? '当前版本不会执行系统级锁机' : '开放白名单会降低竞技可信分'}
          </Text>
        </View>

        <Card>
          <Card.Body className="items-center gap-4 py-8">
            <Text type="h1" weight="bold">
              {formatDuration(remainingSeconds)}
            </Text>
            <Text type="body" color="muted" align="center">
              先完成一个小闭环，再讨论完美不完美。
            </Text>
          </Card.Body>
        </Card>

        <View className="gap-3">
          <SessionRule text="显示任务、剩余时间和励志语" />
          <SessionRule
            text={isLockMode ? '只允许 110 / 120 / 119 与拍照' : '严格选项可自由开关'}
          />
          <SessionRule
            text={isLockMode ? '提前退出占用本月紧急机会' : '退出后填写原因并降低可信等级'}
          />
        </View>
      </View>

      <View className="gap-3">
        <Button variant="primary" size="lg" onPress={onComplete}>
          完成本次闭环
        </Button>
        <Button variant={isLockMode ? 'danger-soft' : 'secondary'} onPress={onExit}>
          {isLockMode ? '紧急退出（扣分）' : '退出专注'}
        </Button>
      </View>
    </View>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function SessionRule({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-panel-inner bg-surface p-3">
      <View className="size-2 rounded-full bg-accent" />
      <Text type="body-sm" className="flex-1">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
