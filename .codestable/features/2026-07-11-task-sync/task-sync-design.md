---
doc_type: feature-design
feature: 2026-07-11-task-sync
requirement:
roadmap: complete-project
roadmap_item: task-sync
status: approved
summary: 实现 SQLite outbox、增量拉取、多设备活跃锁冲突和恢复同步
tags: [mobile, sync, offline, conflicts]
---

# Task Sync 设计

## 1. 目标与策略

采用离线优先：任务和专注操作先在 SQLite 原子落盘，同时写入 outbox；有认证与网络时按顺序推送，再使用服务端 UTC cursor 拉取增量。服务端是跨设备任务 version 和 activeSessionId 的最终权威，客户端不覆盖无法自动合并的冲突。

联网策略在 PRD 标为 TBD，但 roadmap 明确要求离线队列，且技术文档要求锁机/专注短暂断网继续执行，因此本 feature 选择“本地可执行、恢复联网后同步”。

## 2. 本地模型

- `sync_outbox`：operation、entityId、JSON payload、idempotencyKey、attempts、nextAttemptAt、status。
- `sync_entity_map`：本地 session ID 到服务端 session ID 的稳定映射。
- `sync_conflicts`：实体、local/server snapshot、错误 code、创建时间和 resolvedAt。
- `sync_state`：task-focus cursor、最近成功/失败时间。
- tasks 增加 `version` 与 `sync_status`；focus records 增加 `synced_at`。

## 3. 推送编排

1. `task.create` → POST `/tasks`，客户端 UUID 作为服务端主键。
2. `session.start` → POST start-focus/start-lock，记录 local→server session 映射。
3. `session.finish` → 等待映射后 POST finish。
4. `task.goal-progress` → POST progress，携带本地记录的 server version。
5. 409 version/active/idempotency 冲突写入 `sync_conflicts`，不丢弃本地操作；网络和 5xx 指数退避。

## 4. 拉取与合并

- `GET /sync/task-focus?since=`；在单一 SQLite transaction 中 upsert 服务端任务和追加会话，成功后推进 cursor。
- 没有本地 pending operation 的实体可直接采用服务端版本。
- 有 pending operation 且 server version 更高时保留本地数据并生成冲突，等待用户选择“采用云端”或“保留本地后重试”。
- 服务端 activeSessionId 非空且不是当前设备映射时，任务标记 `remote-active`，禁止编辑/开始并展示冲突来源。

## 5. 验收场景

- 离线创建、开始、结束后 outbox 顺序稳定，重启不丢。
- 恢复网络后推送并拉取，成功项标记完成，session 建立映射。
- 版本冲突和其他设备 active lock 可见且不覆盖本地数据。
- 重试采用有上限指数退避，认证缺失不空转。
- fake API 集成测试覆盖成功、断网、冲突、重启恢复；mobile typecheck、tests、Android export 通过。
