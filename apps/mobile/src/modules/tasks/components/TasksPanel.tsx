import { useCallback, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet, Vibration, View } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { Accordion } from 'heroui-native/accordion';
import { PressableFeedback } from 'heroui-native/pressable-feedback';
import { Surface } from 'heroui-native/surface';

import type { ActiveSession, FocusSessionRecord, SessionMode } from '@/modules/focus-session/focus-session.types';
import { lockEngine } from '@/modules/lock-engine/lock-engine.store';
import type { InstalledApp } from '@/modules/lock-engine/lock-engine.types';
import { AppIcon, ApplicationPicker } from '@/modules/whitelist/components/ApplicationPicker';
import { useWhitelistStore } from '@/modules/whitelist/whitelist.store';
import type { RestrictionMode, WhitelistMode } from '@/modules/whitelist/whitelist.types';
import { Button, Card, Input, Label, Text, TextField } from '@/ui/hero-runtime';
import { useLoopTodoTheme } from '@/ui/theme';
import type { CreateTaskResult, UpdateTaskResult } from '../task.store';
import { getTaskExecutionState, taskExecutionReason } from '../task.execution';
import { taskSessionStatistics } from '../task-session.statistics';
import type { CreateTaskInput, Task, TaskCategory, TaskKind, TimerMode, UpdateTaskInput } from '../task.types';
import { normalizeTaskRestriction } from '../task.whitelist';

const collapsedTaskGroupsKey = 'looptodo.collapsed-task-groups';

export function TasksPanel({ tasks, onCreateTask, onStart }: { tasks: Task[]; onCreateTask(input: CreateTaskInput): Promise<CreateTaskResult>; onStart(taskId: string, mode: SessionMode): void }) {
  return <View className="gap-4"><TaskCreateForm onCreate={onCreateTask} /><TaskList tasks={tasks} onStart={onStart} /></View>;
}

export function TaskCreateForm({ categories = [], onCreate, onCreated }: { categories?: TaskCategory[]; onCreate(input: CreateTaskInput): Promise<CreateTaskResult>; onCreated?(taskId: string): void }) {
  return <TaskForm categories={categories} submitLabel="创建任务" onSubmit={onCreate} onSuccess={(result) => {
    if ('taskId' in result) onCreated?.(result.taskId);
  }} />;
}

export function TaskEditForm({ task, categories = [], onUpdate, onUpdated }: { task: Task; categories?: TaskCategory[]; onUpdate(input: UpdateTaskInput): Promise<UpdateTaskResult>; onUpdated?(): void }) {
  return <TaskForm initialTask={task} categories={categories} submitLabel="保存修改" onSubmit={(input) => {
    const { title, categoryId, category, timerMode, estimateMinutes, restMinutes, deadlineAt, targetAmount, targetUnit, mustDo, forcedTriggerTime, restrictionMode, whitelistMode, whitelistListId, whitelistPackages } = input;
    return onUpdate({ title, categoryId, category, timerMode, estimateMinutes, restMinutes, deadlineAt, targetAmount, targetUnit, mustDo, forcedTriggerTime, restrictionMode, whitelistMode, whitelistListId, whitelistPackages });
  }} onSuccess={() => onUpdated?.()} />;
}

function TaskForm({ initialTask, categories, submitLabel, onSubmit, onSuccess }: {
  initialTask?: Task;
  categories?: TaskCategory[];
  submitLabel: string;
  onSubmit(input: CreateTaskInput): Promise<CreateTaskResult | UpdateTaskResult>;
  onSuccess(result: Extract<CreateTaskResult | UpdateTaskResult, { ok: true }>): void;
}) {
  const initialRestriction = normalizeTaskRestriction(initialTask ?? {});
  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [categoryId, setCategoryId] = useState(initialTask?.categoryId ?? '');
  const [kind, setKind] = useState<TaskKind>(initialTask?.kind ?? 'pomodoro');
  const [timerMode, setTimerMode] = useState<TimerMode>(initialTask?.timerMode ?? 'countdown');
  const [minutes, setMinutes] = useState(String(initialTask?.estimateMinutes ?? 25));
  const [restMinutes, setRestMinutes] = useState(String(initialTask?.restMinutes ?? 5));
  const [deadline, setDeadline] = useState(dateInputValue(initialTask?.deadlineAt));
  const [targetAmount, setTargetAmount] = useState(initialTask?.targetAmount == null ? '' : String(initialTask.targetAmount));
  const [targetUnit, setTargetUnit] = useState(initialTask?.targetUnit ?? '页');
  const [mustDo, setMustDo] = useState(initialTask?.mustDo ?? false);
  const [forcedTriggerTime, setForcedTriggerTime] = useState(initialTask?.forcedTriggerTime ?? '20:00');
  const [showMore, setShowMore] = useState(Boolean(initialTask));
  const [restrictionMode, setRestrictionMode] = useState<RestrictionMode>(initialRestriction.restrictionMode);
  const [whitelistMode, setWhitelistMode] = useState<WhitelistMode>(initialRestriction.whitelistMode);
  const [whitelistListId, setWhitelistListId] = useState<string | null>(initialRestriction.whitelistListId);
  const [whitelistPackages, setWhitelistPackages] = useState<string[]>(initialRestriction.whitelistPackages);
  const customWhitelistInitialized = useRef(initialRestriction.whitelistMode === 'custom');
  const [whitelistApps, setWhitelistApps] = useState<InstalledApp[]>([]);
  const [whitelistAppsError, setWhitelistAppsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const whitelistLists = useWhitelistStore((state) => state.lists);
  const whitelistLoading = useWhitelistStore((state) => state.loading);
  const whitelistError = useWhitelistStore((state) => state.error);
  const whitelistLoadError = useWhitelistStore((state) => state.loadError);
  const hydrateWhitelist = useWhitelistStore((state) => state.hydrate);
  const updateWhitelist = useWhitelistStore((state) => state.update);
  const selectedWhitelistList = whitelistLists.find((list) => list.id === whitelistListId) ?? null;
  const whitelistPreviewApps = selectedWhitelistList?.packages
    .map((packageName) => whitelistApps.find((app) => app.packageName === packageName))
    .filter((app): app is InstalledApp => Boolean(app))
    .slice(0, 5) ?? [];
  const loadWhitelistApps = useCallback(async () => {
    setWhitelistAppsError(null);
    try {
      setWhitelistApps(await lockEngine.listLaunchableApps());
    } catch {
      setWhitelistApps([]);
      setWhitelistAppsError('本机软件读取失败，请重试');
    }
  }, []);

  useEffect(() => {
    if (restrictionMode !== 'whitelist') return;
    void hydrateWhitelist();
  }, [hydrateWhitelist, restrictionMode]);

  useEffect(() => {
    if (restrictionMode !== 'whitelist' || whitelistMode !== 'list' || whitelistListId) return;
    const fallback = whitelistLists.find((list) => list.isDefault) ?? whitelistLists[0];
    if (fallback) setWhitelistListId(fallback.id);
  }, [restrictionMode, whitelistListId, whitelistLists, whitelistMode]);

  useEffect(() => {
    if (restrictionMode !== 'whitelist') return;
    void loadWhitelistApps();
  }, [loadWhitelistApps, restrictionMode]);

  const submit = async () => {
    const parsedDeadline = deadline ? Date.parse(`${deadline}T23:59:59`) : null;
    setSubmitError(null);
    if (restrictionMode === 'whitelist') {
      if (whitelistError) {
        setSubmitError(whitelistError);
        return;
      }
      if (whitelistLoading) {
        setSubmitError('名单仍在读取，请稍后重试');
        return;
      }
      if (whitelistMode === 'list' && !selectedWhitelistList) {
        setSubmitError('请选择可用名单');
        return;
      }
    }
    const category = categories?.find((item) => item.id === categoryId);
    const result = await onSubmit({
      title: title.trim(), categoryId: category?.id ?? null, category: category?.name ?? '未分类', kind,
      timerMode: kind === 'goal' ? 'countdown' : timerMode,
      estimateMinutes: Number(minutes), restMinutes: Number(restMinutes),
      deadlineAt: Number.isFinite(parsedDeadline) ? parsedDeadline : null,
      targetAmount: kind === 'goal' ? Number(targetAmount) : null,
      targetUnit: kind === 'goal' ? targetUnit.trim() : null,
      mustDo, forcedTriggerTime: mustDo ? forcedTriggerTime : null,
      trustLevel: initialTask?.trustLevel ?? 'medium',
      restrictionMode,
      whitelistMode,
      whitelistListId: restrictionMode === 'whitelist' && whitelistMode === 'list' ? whitelistListId : null,
      whitelistPackages: restrictionMode === 'whitelist' && whitelistMode === 'custom' ? whitelistPackages : [],
    });
    if (result.ok) {
      if (!initialTask) setTitle('');
      onSuccess(result);
    } else {
      setSubmitError(result.error);
    }
  };

  const changeWhitelistMode = (value: string) => {
    const nextMode = value as WhitelistMode;
    if (nextMode === 'custom' && !customWhitelistInitialized.current) {
      const selectedList = whitelistLists.find((list) => list.id === whitelistListId)
        ?? whitelistLists.find((list) => list.isDefault)
        ?? whitelistLists[0];
      setWhitelistPackages(selectedList ? [...selectedList.packages] : []);
      customWhitelistInitialized.current = true;
    }
    setWhitelistMode(nextMode);
  };
  const restrictionSummary = restrictionMode === 'none'
    ? '不限制'
    : restrictionMode === 'strict'
      ? '严格模式'
      : whitelistMode === 'custom'
        ? `软件白名单 · 为此任务单独设置 · ${whitelistPackages.length} 个软件`
        : `软件白名单 · ${selectedWhitelistList?.name ?? (whitelistLoading ? '正在读取场景白名单' : '未选择场景白名单')}`;

  return <View className="gap-3">
    <Field label="任务名" value={title} onChange={setTitle} placeholder="例如：完成物理作业" />
    <View className="gap-2"><Text type="body-xs" color="muted">分类</Text><ChoiceRow value={categoryId} options={[["", "未分类"], ...(categories ?? []).map((item) => [item.id, item.name] as [string, string])]} onChange={setCategoryId} /></View>
    {kind === 'goal' ? <Text type="body-sm" color="muted">计时方式：倒计时</Text> : <ChoiceRow value={timerMode} options={[["countdown", "倒计时"], ["countup", "正计时"], ["untimed", "不计时"]]} onChange={(value) => setTimerMode(value as TimerMode)} />}
    {timerMode === 'countdown' || kind === 'goal' ? <Field label={kind === 'goal' ? '单次专注分钟' : '专注分钟'} value={minutes} onChange={setMinutes} keyboard="numeric" /> : null}
    <Button variant="secondary" onPress={() => setShowMore((value) => !value)}>{showMore ? '收起更多设置' : '更多设置'}</Button>
    {!showMore ? <Text type="body-xs" color="muted">当前限制：{restrictionSummary}</Text> : null}
    {restrictionMode === 'whitelist' && whitelistAppsError ? <View className="gap-2">
      <Text type="body-sm" color="danger" accessibilityRole="alert">{whitelistAppsError}</Text>
      <Button size="sm" variant="secondary" accessibilityLabel="重试读取本机软件" onPress={() => void loadWhitelistApps()}>重试读取本机软件</Button>
    </View> : null}
    {showMore ? <View className="gap-3">
      {!initialTask ? <ChoiceRow value={kind} options={[["pomodoro", "普通任务"], ["goal", "定目标"]]} onChange={(value) => setKind(value as TaskKind)} /> : null}
      {kind === 'goal' ? <><Field label="截止日期" value={deadline} onChange={setDeadline} placeholder="YYYY-MM-DD" /><View className="flex-row gap-2"><View className="flex-1"><Field label="目标量" value={targetAmount} onChange={setTargetAmount} placeholder="例如 30" keyboard="numeric" /></View><View className="flex-1"><Field label="单位" value={targetUnit} onChange={setTargetUnit} placeholder="页/个/套/小时/次" /></View></View></> : null}
      <Field label="休息分钟" value={restMinutes} onChange={setRestMinutes} keyboard="numeric" />
      <Button variant={mustDo ? 'danger-soft' : 'secondary'} onPress={() => setMustDo((value) => !value)}>{mustDo ? '今日必须，按时强制锁机' : '设为今日必须'}</Button>
      {mustDo ? <Field label="强制触发时间" value={forcedTriggerTime} onChange={setForcedTriggerTime} placeholder="HH:mm" /> : null}
      <View className="gap-2">
        <Text type="body-xs" color="muted">专注限制</Text>
        <ChoiceRow value={restrictionMode} options={[["none", "不限制"], ["whitelist", "软件白名单"], ["strict", "严格模式"]]} onChange={(value) => setRestrictionMode(value as RestrictionMode)} />
        {restrictionMode === 'whitelist' ? <View className="gap-2">
          <ChoiceRow value={whitelistMode} options={[["list", "使用场景白名单"], ["custom", "为此任务单独设置"]]} onChange={changeWhitelistMode} />
          {whitelistMode === 'list' ? <View className="gap-2">
            <ChoiceRow value={whitelistListId ?? ''} options={whitelistLists.map((list) => [list.id, list.name])} onChange={setWhitelistListId} />
            {selectedWhitelistList ? <>
              <Text type="body-xs" color="muted">{selectedWhitelistList.packages.length} 个软件</Text>
              {whitelistPreviewApps.length ? <View className="flex-row gap-2">
                {whitelistPreviewApps.map((app) => <AppIcon key={app.packageName} app={app} size="small" testID={`task-whitelist-icon-${app.packageName}`} />)}
              </View> : null}
              {selectedWhitelistList.packages.length === 0 ? <Text type="body-xs" color="muted">未选择其他软件，专注期间只能使用 LoopTodo</Text> : null}
              <Text type="body-xs" color="muted">修改后，使用此场景白名单且尚未开始的任务会同步更新。</Text>
              <ApplicationPicker title={`编辑“${selectedWhitelistList.name}”`} source="task" listId={selectedWhitelistList.id}
                triggerLabel="修改场景白名单" apps={whitelistApps} selected={selectedWhitelistList.packages}
                onChange={(nextPackages) => updateWhitelist({ ...selectedWhitelistList, packages: nextPackages })} />
            </> : <Text type="body-xs" color="danger">暂无可用场景白名单</Text>}
          </View> : <ApplicationPicker title="本任务单独设置" source="task" listId={selectedWhitelistList?.id}
            apps={whitelistApps} selected={whitelistPackages} onChange={setWhitelistPackages} />}
        </View> : null}
      </View>
    </View> : null}
    {restrictionMode === 'whitelist' && whitelistLoadError ? <View className="gap-2">
      <Text type="body-sm" color="danger" accessibilityRole="alert">{whitelistLoadError}</Text>
      <Button size="sm" variant="secondary" accessibilityLabel="重试读取场景白名单" onPress={() => { setSubmitError(null); void hydrateWhitelist(true); }}>重试读取场景白名单</Button>
    </View> : null}
    {submitError && submitError !== whitelistLoadError ? <Text type="body-sm" color="danger" accessibilityRole="alert">{submitError}</Text> : null}
    <Button isDisabled={!title.trim()} onPress={() => void submit()}>{submitLabel}</Button>
    {!title.trim() ? <Text type="body-xs" color="muted">填写任务名后即可保存</Text> : null}
  </View>;
}

export function CategoryManager({ categories, onCreate, onUpdate, onDelete }: {
  categories: TaskCategory[];
  onCreate(name: string): Promise<{ ok: boolean }>;
  onUpdate(id: string, version: number, name: string): Promise<{ ok: boolean }>;
  onDelete(id: string, version: number): Promise<{ ok: boolean }>;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});
  return <View className="gap-3"><Field label="新分类" value={name} onChange={setName} placeholder="例如：学习" /><Button isDisabled={!name.trim()} onPress={async () => { const result = await onCreate(name); if (result.ok) setName(''); }}>创建分类</Button>{categories.map((category) => <View key={category.id} className="gap-2 rounded-panel-inner bg-surface-secondary p-3"><Field label="分类名称" value={editing[category.id] ?? category.name} onChange={(value) => setEditing((current) => ({ ...current, [category.id]: value }))} /><View className="flex-row gap-2"><Button className="flex-1" size="sm" variant="secondary" onPress={() => void onUpdate(category.id, category.version, editing[category.id] ?? category.name)}>保存</Button><Button className="flex-1" size="sm" variant="danger-soft" onPress={() => void onDelete(category.id, category.version)}>删除</Button></View></View>)}</View>;
}

export function TaskList({ tasks, activeSession = null, onStart, onOpenActions }: {
  tasks: Task[];
  activeSession?: ActiveSession | null;
  onStart(taskId: string, mode: SessionMode): void;
  onOpenActions?(taskId: string): void;
}) {
  return <View>{tasks.length === 0 ? <Card><Card.Body><Card.Title>还没有任务</Card.Title><Card.Description>创建一个最小任务，开始今天的闭环。</Card.Description></Card.Body></Card> : tasks.map((task, index) => <View key={task.id}>{index ? <View style={styles.taskDivider} /> : null}<TaskRow task={task} activeSession={activeSession} onStart={onStart} onOpenActions={onOpenActions} /></View>)}</View>;
}

export function TaskGroups({ tasks, categories, activeSession = null, onStart, onOpenActions }: {
  tasks: Task[];
  categories: TaskCategory[];
  activeSession?: ActiveSession | null;
  onStart(taskId: string, mode: SessionMode): void;
  onOpenActions?(taskId: string): void;
}) {
  const pendingTasks = tasks.filter((task) => task.status !== 'completed');
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const tasksByCategory = new Map(categories.map((category) => [category.id, [] as Task[]]));
  const uncategorized: Task[] = [];
  for (const task of pendingTasks) {
    const categoryTasks = task.categoryId ? tasksByCategory.get(task.categoryId) : null;
    if (categoryTasks) categoryTasks.push(task);
    else uncategorized.push(task);
  }
  const groups = categories.map((category) => ({ id: category.id, title: category.name, tasks: tasksByCategory.get(category.id) ?? [] }))
    .filter((group) => group.tasks.length > 0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(['completed']));
  const touchedGroupsRef = useRef(new Set<string>());
  const preferenceWriteRef = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(collapsedTaskGroupsKey).then((value) => {
      if (!cancelled && value) {
        const saved = new Set(JSON.parse(value) as string[]);
        setCollapsedGroups((current) => {
          const next = new Set(current);
          for (const groupId of saved) if (!touchedGroupsRef.current.has(groupId)) next.add(groupId);
          for (const groupId of current) {
            if (!saved.has(groupId) && !touchedGroupsRef.current.has(groupId)) next.delete(groupId);
          }
          return next;
        });
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const toggleGroup = (groupId: string) => {
    touchedGroupsRef.current.add(groupId);
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      preferenceWriteRef.current = preferenceWriteRef.current
        .catch(() => undefined)
        .then(() => SecureStore.setItemAsync(collapsedTaskGroupsKey, JSON.stringify([...next])))
        .catch(() => undefined);
      return next;
    });
  };

  if (uncategorized.length) groups.push({ id: 'uncategorized', title: '未分类', tasks: uncategorized });

  if (groups.length === 0 && completedTasks.length === 0) return <TaskList tasks={[]} activeSession={activeSession} onStart={onStart} onOpenActions={onOpenActions} />;

  const expandedGroups = [...groups.map((group) => group.id), ...(completedTasks.length ? ['completed'] : [])].filter((groupId) => !collapsedGroups.has(groupId));
  const allGroups = [...groups, ...(completedTasks.length ? [{ id: 'completed', title: '已完成', tasks: completedTasks }] : [])];
  return <Accordion selectionMode="multiple" value={expandedGroups} onValueChange={(values: string[]) => {
    const nextExpanded = new Set(values);
    for (const group of allGroups) if (nextExpanded.has(group.id) === collapsedGroups.has(group.id)) toggleGroup(group.id);
  }} variant="surface" hideSeparator className="gap-3">{allGroups.map((group) => <TaskGroup key={group.id} id={group.id} title={group.title} tasks={group.tasks} collapsed={collapsedGroups.has(group.id)} activeSession={activeSession} onStart={onStart} onOpenActions={onOpenActions} />)}</Accordion>;
}

export function TaskActionPanel({ task, records, activeSession, onEdit, onStart, onGoalProgress, onDelete }: {
  task: Task;
  records: FocusSessionRecord[];
  activeSession: ActiveSession | null;
  onEdit(): void;
  onStart(): void;
  onGoalProgress(amount: number): Promise<void>;
  onDelete(): Promise<void>;
}) {
  const [progress, setProgress] = useState('1');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statistics = taskSessionStatistics(records, task.id);
  const executionState = getTaskExecutionState(task, activeSession);
  const canEdit = !['local_active', 'remote_active', 'stale_active', 'sync_conflict'].includes(executionState);
  const canFocus = executionState === 'available' || executionState === 'local_active';
  return <View className="gap-4"><View className="flex-row gap-3"><Metric label="完成专注" value={`${statistics.completedSessions} 次`} /><Metric label="累计专注" value={`${statistics.completedMinutes} 分钟`} /></View><View className="flex-row gap-2"><Button className="flex-1" variant="secondary" isDisabled={!canEdit} onPress={onEdit}>编辑任务</Button><Button className="flex-1" isDisabled={!canFocus} onPress={onStart}>开始专注</Button></View>{!canEdit ? <Text type="body-xs" color="muted">任务执行中或存在同步问题，暂时不能编辑。</Text> : null}{task.kind === 'goal' && executionState === 'available' ? <View className="flex-row items-end gap-2"><View className="flex-1"><Field label={`补记完成量（${task.targetUnit}）`} value={progress} onChange={setProgress} keyboard="numeric" /></View><Button size="sm" onPress={() => void onGoalProgress(Number(progress))}>记录</Button></View> : null}{confirmDelete ? <View className="gap-2 rounded-panel-inner bg-surface-secondary p-3"><Text type="body-sm">删除后不会进入回收站，确定删除“{task.title}”吗？</Text><View className="flex-row gap-2"><Button className="flex-1" variant="danger" onPress={() => void onDelete()}>确认删除</Button><Button className="flex-1" variant="secondary" onPress={() => setConfirmDelete(false)}>取消</Button></View></View> : <Button variant="danger-soft" isDisabled={!canEdit} onPress={() => setConfirmDelete(true)}>删除任务</Button>}</View>;
}

function TaskGroup({ id, title, tasks, collapsed, activeSession, onStart, onOpenActions }: {
  id: string;
  title: string;
  tasks: Task[];
  collapsed: boolean;
  activeSession: ActiveSession | null;
  onStart(taskId: string, mode: SessionMode): void;
  onOpenActions?(taskId: string): void;
}) {
  const { colors } = useLoopTodoTheme();
  return <Accordion.Item value={id}><Surface testID={`task-group-surface-${id}`} variant="secondary" className="overflow-hidden rounded-2xl border border-border/60"><View testID="task-group" accessibilityLabel={title}><Accordion.Trigger accessibilityRole="button" accessibilityLabel={`${collapsed ? '展开' : '折叠'}${title}任务组`} accessibilityState={{ expanded: !collapsed }} className="min-h-12 flex-row items-center gap-3 px-4"><View className="min-w-0 flex-1 flex-row items-center gap-2"><Text type="body-sm" weight="semibold" numberOfLines={1}>{title}</Text><Text type="body-xs" color="accent">{tasks.length}</Text></View><Text type="body-sm" color="muted">{collapsed ? '›' : '⌄'}</Text></Accordion.Trigger><Accordion.Content><View style={[styles.groupRows, { borderTopColor: colors.separator }]}>{tasks.map((task, index) => <View key={task.id}>{index ? <View style={[styles.taskDivider, { backgroundColor: colors.separator }]} /> : null}<TaskRow task={task} activeSession={activeSession} onStart={onStart} onOpenActions={onOpenActions} /></View>)}</View></Accordion.Content></View></Surface></Accordion.Item>;
}

function TaskRow({ task, activeSession, onStart, onOpenActions }: { task: Task; activeSession: ActiveSession | null; onStart(taskId: string, mode: SessionMode): void; onOpenActions?(taskId: string): void }) {
  const executionState = getTaskExecutionState(task, activeSession);
  const canStart = executionState === 'available' || executionState === 'local_active';
  const reason = taskExecutionReason(executionState);
  return <PressableFeedback testID={`task-row-feedback-${task.id}`} accessible={false} delayLongPress={320} onLongPress={() => { Vibration.vibrate(20); onOpenActions?.(task.id); }} animation={{ scale: { value: 0.992 } }}><View testID={`task-row-${task.id}`} style={styles.taskRow}><View className="min-w-0 flex-1 gap-1"><Text type="body-sm" weight="semibold" numberOfLines={1}>{task.title}</Text><View className="flex-row flex-wrap items-center gap-2">{task.mustDo ? <MustDoLabel time={task.forcedTriggerTime} /> : null}<Text type="body-xs" color="muted" numberOfLines={1}>{reason && executionState !== 'completed' ? reason : compactTaskMeta(task, executionState)}</Text></View></View><MoreButton label={`${task.title}更多操作`} onPress={() => onOpenActions?.(task.id)} /><StartButton label={`${executionState === 'local_active' ? '继续' : '开始'}${task.title}专注`} disabled={!canStart} onPress={() => onStart(task.id, 'focus')} /></View></PressableFeedback>;
}

function MustDoLabel({ time }: { time: string | null }) {
  const { colors } = useLoopTodoTheme();
  return <View className="flex-row items-center gap-1"><Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth={2.2}><Rect x={5} y={10} width={14} height={10} rx={2} /><Path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg><Text type="body-xs" color="danger">今日必须 {time ?? ''}</Text></View>;
}

function MoreButton({ label, onPress }: { label: string; onPress(): void }) {
  const { colors } = useLoopTodoTheme();
  return <PressableFeedback accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.separator }]}><Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.textMuted}><Circle cx={5} cy={12} r={1.7} /><Circle cx={12} cy={12} r={1.7} /><Circle cx={19} cy={12} r={1.7} /></Svg></PressableFeedback>;
}

function StartButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress(): void }) {
  const { colors } = useLoopTodoTheme();
  return <PressableFeedback accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} isDisabled={disabled} hitSlop={4} onPress={onPress} style={[styles.startButton, { backgroundColor: disabled ? colors.disabled : colors.accent }]}><Svg width={18} height={18} viewBox="0 0 24 24" fill={colors.surface}><Polygon points="8,5 19,12 8,19" /></Svg></PressableFeedback>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View className="flex-1 rounded-panel-inner bg-surface-secondary p-3"><Text type="body-xs" color="muted">{label}</Text><Text type="body-sm" weight="semibold">{value}</Text></View>;
}

function Field({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange(value: string): void; placeholder?: string; keyboard?: 'numeric' }) {
  return <TextField><Label>{label}</Label><Input value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboard} /></TextField>;
}

function ChoiceRow({ value, options, onChange }: { value: string; options: [string, string][]; onChange(value: string): void }) {
  return <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">{options.map(([id, label]) => <Button key={id} size="sm" variant={value === id ? 'primary' : 'secondary'} accessibilityRole="radio" accessibilityState={{ selected: value === id }} onPress={() => onChange(id)}>{label}</Button>)}</View>;
}

function compactTaskMeta(task: Task, executionState: ReturnType<typeof getTaskExecutionState>) {
  if (executionState === 'completed') return '已完成';
  if (task.kind === 'goal') return `目标 ${task.completedAmount}/${task.targetAmount ?? 0} ${task.targetUnit ?? ''} · ${task.estimateMinutes} 分钟`;
  return task.timerMode === 'untimed' ? '不计时' : `${task.estimateMinutes} 分钟`;
}

function dateInputValue(value?: number | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  groupHeader: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupRows: { borderTopWidth: StyleSheet.hairlineWidth },
  taskRow: { minHeight: 44, paddingLeft: 12, paddingRight: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskDivider: { height: StyleSheet.hairlineWidth, marginLeft: 12 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  startButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  pressed: { opacity: 0.75 },
});
