---
doc_type: feature-acceptance
feature: 2026-07-11-task-focus-api
status: passed
accepted: 2026-07-11
round: 1
---

# Task Focus API 验收报告

## 1. API 契约

- 分类、任务 CRUD、任务完成、开始 focus/lock、结束与查询会话、增量同步接口已落地。
- 所有接口复用认证 access guard 与统一 `{data,error}` 响应。

## 2. 一致性

- 任务更新和归档使用 version 乐观锁；开始/结束会话使用 Serializable transaction。
- 会话记录追加写，activeSessionId 保证单任务最多一个进行中会话。
- 删除转换为 archived，仍会被同步端读取。

## 3. 安全与隔离

- 每个 repository 操作按 userId 限定；跨用户读取返回 404。
- Idempotency-Key 同用户唯一并与具体操作绑定。

## 4. Roadmap 回写

- `task-focus-api` 完成，为移动端同步、习惯目标、锁机和统计提供服务端任务事实来源。

## 5. 遗留

- 真 PostgreSQL 并发压力、复合分页游标和移动端离线队列由后续 feature 验证。
