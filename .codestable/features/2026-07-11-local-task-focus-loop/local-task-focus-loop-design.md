---
doc_type: feature-design
feature: 2026-07-11-local-task-focus-loop
requirement:
roadmap: complete-project
roadmap_item: local-task-focus-loop
status: approved
summary: 使用 Expo SQLite 和 Zustand 实现可重启恢复的本地任务与专注闭环
tags: [mobile, sqlite, focus, tasks]
---

# Local Task Focus Loop 设计

## 0. 术语

| 术语 | 定义 |
|---|---|
| Timer Mode | `countdown`、`countup`、`untimed` 三种普通专注计时方式 |
| Focus Phase | 正在执行任务的阶段 |
| Rest Phase | 倒计时任务完成后按配置进入的自由休息阶段 |
| Goal Confirmation | 定目标会话完成时由用户填写本次实际完成量 |
| Local Snapshot | SQLite 中任务、记录和唯一活跃会话组成的可恢复状态 |

## 1. 决策与约束

### 需求摘要

落实 PRD R003/R004/R005：创建普通番茄钟或定目标任务；普通任务支持倒计时、正计时和不计时；倒计时支持 25、35 和自定义分钟；休息默认 5 分钟且可自定义；定目标包含截止日期、目标量、单位和单次专注时长，完成时由用户确认本次完成量。任务、专注记录和进行中状态写入 SQLite，App 重启后恢复。

### 明确不做

- 不实现锁机、Android 原生重启广播、云同步、账号、分类管理页面、积分或失败原因完整表单。
- 不实现暂停；退出直接生成 exited 记录。
- 休息只在倒计时正常完成后进入，休息期间可手动结束并回首页。

### 关键决策

1. 使用 Expo SDK 57 `expo-sqlite` 的 `openDatabaseAsync` 与事务 API，不自研存储层。
2. SQLite 是持久化事实来源，Zustand 是运行时快照；hydrate 一次加载任务、历史和唯一活跃会话。
3. `active_sessions` 只允许单行，开始、结束、进入/结束休息均在 repository 事务中完成。
4. 计时显示由持久化时间戳推导，不持久化每秒 tick；重启后倒计时按 `plannedEndAt` 恢复，正计时按 `startedAt` 恢复。
5. 定目标完成量必须由用户输入；repository 原子更新累计量、任务状态、记录并清理活跃会话。

### 数据表

- `tasks`：任务类型、timer mode、预计/休息分钟、截止日期、目标量、单位、已完成量、状态和展示字段。
- `focus_sessions`：追加式会话记录，保存 timer mode、开始/结束、outcome、时长和本次完成量。
- `active_sessions`：唯一活跃 focus/rest 快照，保存 task/session、phase、开始、计划结束和休息结束时间。
- `schema_migrations`：当前 schema 版本。

## 2. 接口与编排

```ts
type LocalSnapshot = {
  tasks: Task[];
  sessionRecords: FocusSessionRecord[];
  activeSession: ActiveSession | null;
};

interface TaskRepository {
  hydrate(): Promise<LocalSnapshot>;
  create(input: CreateTaskInput): Promise<Task>;
  startSession(task: Task, session: ActiveSession): Promise<void>;
  finishSession(task: Task, record: FocusSessionRecord, rest: ActiveSession | null): Promise<void>;
  finishRest(): Promise<void>;
}
```

编排：App 启动 → SQLite migration → store hydrate → 用户创建任务 → repository insert → 开始会话事务写 task active + active session → UI 按时间戳显示 → 完成时写 record、任务进度与可选 rest → rest 结束清理 active session → 回首页。

## 3. 验收场景

1. 创建 25/35/自定义倒计时任务，重开 App 后仍存在。
2. 创建正计时和不计时任务，开始后显示方式正确。
3. 创建定目标任务，截止日期、目标量、单位和单次时长持久化。
4. 定目标完成时必须填写正数完成量，累计达到目标后任务 completed。
5. 倒计时正常完成进入配置休息，休息结束或手动结束后回首页。
6. 专注中重启 App，可从 SQLite 恢复任务、模式和基于时间戳计算的进度。
7. 同时触发完成/退出最多写一条记录；SQLite 错误进入显式 error state。

## 4. 项目级影响

- 落实技术文档 3.4 状态机、3.5 本地持久化及 tasks/focus_sessions 数据模型的本地子集。
- 保持 `TaskRepository` 为 SQLite 与后续同步 adapter 的统一入口。
