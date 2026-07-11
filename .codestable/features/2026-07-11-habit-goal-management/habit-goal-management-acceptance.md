---
doc_type: feature-acceptance
feature: 2026-07-11-habit-goal-management
status: passed
accepted: 2026-07-11
round: 1
---

# Habit Goal Management 验收报告

## 1. 用户能力

- 移动端新增习惯面板，可创建每日分钟目标、配置强制约束时间、记录进度和归档。
- goal task 可在任务列表补记数量，达到目标自动完成。

## 2. 数据与 API

- SQLite 与 PostgreSQL 均建立习惯、习惯进度和任务进度模型。
- Habit API 支持列表、创建、更新、归档和进度历史；目标进度 API 使用 version 与 Idempotency-Key。
- forced_lock_rules 只保存规则，未越界执行提醒或锁机调度。

## 3. Roadmap 回写

- `habit-goal-management` 完成，为强制调度、订阅权益和统计提供习惯与目标事实来源。

## 4. 遗留

- 免费/VIP 数量限制、提醒调度和真实锁机由对应后续 feature 实现。
