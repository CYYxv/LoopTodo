---
doc_type: feature-acceptance
feature: 2026-07-11-local-task-focus-loop
status: passed
accepted: 2026-07-11
round: 1
---

# Local Task Focus Loop 验收报告

## 1. 接口契约

- `TaskRepository` 通过 hydrate/create/start/finish/finishRest 覆盖完整本地闭环。
- SQLite adapter 与 memory test adapter 使用同一契约。

## 2. 行为与决策

- 普通任务支持倒计时、正计时、不计时和自定义休息。
- 定目标支持截止日期、目标量、单位、单次专注时长和用户填写的本次完成量。
- 任务、记录与唯一活跃会话均持久化；Zustand 不代替 SQLite 成为事实来源。

## 3. 验收场景

- 创建、开始、完成、退出、目标累计、休息和重启恢复均有通过的测试或 Android bundle 证据。
- 重复结束最多追加一条记录；事务失败保留可重试活跃会话。

## 4. 范围核对

- 未实现锁机、账号、云同步、积分、分类管理或 Android 原生广播，符合本 feature 边界。

## 5. Roadmap 回写

- `local-task-focus-loop` 完成，LoopTodo 已具备可离线演示的最小任务执行闭环。

## 6. 遗留

- 真机 SQLite 与系统进程重启场景在 `android-compatibility` 和 `release-apk` 阶段复核。
