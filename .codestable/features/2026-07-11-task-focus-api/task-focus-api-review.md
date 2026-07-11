---
doc_type: feature-review
feature: 2026-07-11-task-focus-api
status: passed
reviewer: self
reviewed: 2026-07-11
round: 1
---

# Task Focus API 代码审查报告

## 范围与结论

- owner 已批准本地审查降级；本轮只审查任务、分类、会话、同步和 Prisma 变更。
- controller 从 access token 取 userId，repository 每个查询与条件写均包含 userId，越权资源统一不可见。
- task version 条件写、activeSessionId 单会话占用和 session 结束释放均在事务边界表达。
- start/finish 幂等键与目标资源、操作类型绑定，重复请求返回原记录，不同操作复用返回冲突。

## 已修复发现

- blocking: 会话结束最初未检查 task release 的更新数量，可能出现记录已结束但 task 仍 active；已在事务中检查并回滚。
- important: active task 最初仍允许 PATCH；已统一禁止 active task 更新、完成或归档。
- important: 幂等键最初可跨任务/会话误复用；已绑定 task/session 与 mode/outcome。
- important: 增量同步最初每表截断 500 条却返回当前时间游标，可能跳过未返回数据；已移除不安全截断，后续专门设计复合分页游标。
- important: 并发创建同名分类的唯一约束已映射为稳定 `CATEGORY_EXISTS`。

## Residual Risk

- 当前无真实 PostgreSQL 进程，Serializable 事务和唯一约束通过 Prisma schema、类型系统与内存 E2E 证明；真实数据库并发压测留给 system-hardening。

## Verdict

- Status: passed
- 无 unresolved blocking 或 important finding。
