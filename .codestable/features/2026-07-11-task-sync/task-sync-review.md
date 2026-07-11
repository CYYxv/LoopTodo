---
doc_type: feature-review
feature: 2026-07-11-task-sync
status: passed
reviewer: self
reviewed: 2026-07-11
round: 1
---

# Task Sync 代码审查报告

## 范围与结论

- owner 已批准本地审查降级；审查覆盖 SQLite migration、outbox、HTTP client、同步 engine、冲突 UI 和服务端同步契约。
- 任务/会话/目标进度与 outbox 在同一 SQLite transaction 写入；会话 start/finish 通过本地与服务端 ID 映射保持顺序。
- 推送 409 转为可见冲突，网络错误指数退避；拉取 cursor 只在完整 merge transaction 后推进。

## 已修复发现

- blocking: 离线会话最初若同步时才调用 start/finish，会丢失真实执行时间；API 现接受客户端 session UUID、startedAt、endedAt 和实际分钟。
- important: outbox 同毫秒记录只按时间排序可能乱序；已增加 SQLite rowid 次序。
- important: push 网络失败后继续推送依赖操作会产生连锁错误；已在可重试错误后停止当前批次，同实体冲突阻断后续操作。
- important: pending 本地任务最初可能被较旧服务端快照覆盖；现只保留本地，服务端版本相等或更高时生成冲突。
- important: unresolved conflict 的 outbox 状态最初不参与 merge 守护，后续拉取可能覆盖本地；已同时识别 pending/conflict。
- important:远端 session 最初会和已映射的本地记录重复；现命中映射时仅标记本地记录 synced。
- important: 冲突“采用云端”最初可能丢弃同任务全部操作；现优先只处理关联 outbox，实体级版本冲突才处理整组。
- important: 本地 version 现随 start/finish/progress 预增，与服务端顺序写版本保持一致。
- important: 客户端 UUID 重试创建任务现幂等；相同 UUID 不同内容返回 `TASK_IDENTITY_CONFLICT`。

## Residual Risk

- 移动端账号界面尚未接入，因此 HTTP sync client 由后续登录流程调用 `configureSync`；未配置时明确显示“登录后启用”，不会伪装已同步。
- 当前无真实 PostgreSQL/多设备真机，跨设备并发将在 system-hardening 与兼容阶段复核。

## Verdict

- Status: passed
- 无 unresolved blocking 或 important finding。
