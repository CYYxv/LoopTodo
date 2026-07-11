---
doc_type: feature-design
feature: 2026-07-11-habit-goal-management
requirement:
roadmap: complete-project
roadmap_item: habit-goal-management
status: approved
summary: 实现本地与服务端习惯、目标进度和强制约束配置
tags: [mobile, api, habits, goals]
---

# Habit Goal Management 设计

## 1. 目标与边界

实现 PRD Habit 对象与习惯/目标页面：用户可创建习惯，设置每日目标分钟数、是否参与强制约束和触发时间，手动记录当日进度；定目标任务继续使用截止日期、目标量、单位和单次专注时长，并允许在任务列表直接补记完成量。

本 feature 保存强制约束配置，但不调度提醒、延迟或锁机；免费/VIP 习惯数量限制由 subscription feature 统一接管。

## 2. 数据与接口

- 本地 SQLite：`habits`、`habit_progress_entries`，Zustand habit store 负责 hydrate、创建、进度和归档。
- PostgreSQL：`habits`、`habit_progress_entries`、`forced_lock_rules`；所有写入使用 version 或 Idempotency-Key。
- API：`GET/POST /habits`、`PATCH/DELETE /habits/:id`、`POST /habits/:id/progress`、`GET /habits/:id/progress`。
- 目标任务 API 增加 `POST /tasks/:id/progress`，按 version 原子累加并在达到 targetAmount 时完成。

## 3. 不变量

1. 习惯与进度按 userId 隔离，删除为 archived。
2. 进度为正分钟数，单个 Idempotency-Key 只记一次。
3. 强制约束开启时必须有 `HH:mm` 触发时间；规则默认 buffer=10、maxDelay=2、delay=20。
4. goal task 进度必须为正数，累计值不超过目标；达到目标后 status=completed。
5. 本地习惯和目标进度写入 SQLite 后再更新 Zustand，不静默回退。

## 4. 验收场景

- 创建普通习惯和开启强制约束的习惯，重启后恢复。
- 记录习惯分钟数并显示今日进度，重复 key 不重复累计。
- 修改习惯时旧 version 冲突，跨用户资源不可见。
- 给 goal task 补记完成量，达到目标后完成；普通番茄任务拒绝该接口。
- 移动端习惯面板可创建、记录进度和查看强制触发配置。
- mobile/API typecheck、tests 和 build/export 通过。
