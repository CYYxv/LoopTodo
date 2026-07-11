---
doc_type: feature-design
feature: 2026-07-11-task-focus-api
requirement:
roadmap: complete-project
roadmap_item: task-focus-api
status: approved
summary: 提供任务、分类、专注会话的租户隔离、幂等、乐观锁与增量同步 API
tags: [api, tasks, focus, sync]
---

# Task Focus API 设计

## 1. 目标与边界

实现技术文档 Task API、任务分类与追加式 focus session。所有查询按 access token 用户隔离；任务更新使用 `version` 乐观锁；开始和结束会话接受 `Idempotency-Key`；增量同步按服务端 `updatedAt` 游标返回任务、分类和会话变化。

本 feature 只记录 `mode=lock` 会话，不处理 Android 权限、紧急退出额度和 lock_sessions 细节；习惯、强制规则、完成量高级管理和移动端离线队列由后续 feature 完成。

## 2. 接口

- `GET/POST /task-categories`
- `GET/POST /tasks`
- `GET/PATCH/DELETE /tasks/:id`
- `POST /tasks/:id/start-focus`
- `POST /tasks/:id/start-lock`
- `POST /focus-sessions/:id/finish`
- `GET /focus-sessions`
- `GET /sync/task-focus?since=<ISO timestamp>`

## 3. 不变量

1. repository 的所有 task/category/session 操作必须带 `userId`，不存在与越权统一返回 not found。
2. 每个任务最多一个 active session；开始会话事务更新 task.activeSessionId 和 version。
3. `Idempotency-Key` 在同一用户范围唯一，相同 key 返回原结果，不重复创建或结束记录。
4. PATCH 必须携带 version，数据库条件更新 count=0 返回 `VERSION_CONFLICT`。
5. finish 事务只允许 active session，计算实际分钟、更新 outcome、清空 task.activeSessionId 并递增 version。
6. 删除采用 archived 状态以进入增量同步，不做物理删除。

## 4. 验收场景

- 两个用户不能读取或修改对方任务。
- 重复开始/结束请求返回同一会话且不重复写入。
- 旧 version 更新返回 409，最新 version 更新成功。
- active task 不能再启动第二个会话。
- 增量同步只返回当前用户且 `updatedAt > since` 的变化。
- Prisma schema、API e2e、typecheck 与 build 通过。
