---
doc_type: feature-design
feature: 2026-07-11-notification-delivery
requirement:
roadmap: complete-project
roadmap_item: notification-delivery
status: approved
summary: 统一本地提醒与远程推送事件、设备 token、provider adapter 和重试队列
tags: [mobile, notifications, push, retry]
---

# Notification Delivery 设计

## 1. 目标与边界

建立统一 `NotificationEvent`，同时驱动移动端本地提醒和服务端远程推送。移动端使用 Expo Notifications 处理 Android channel、权限和本地调度；服务端保存设备 token、通知事件和交付尝试，通过 FCM/vendor provider port 发送并指数退避。

本 feature 不实现具体家庭、奖励、强制调度业务，只提供这些模块可调用的通知入口；外部推送凭证缺失时不伪造成功，开发测试使用明确的 in-memory provider。

## 2. 事件契约

- `forced_lock_buffer`：强制触发前 10 分钟提醒。
- `family_anomaly`：未完成、提前退出、权限关闭、重启规避等异常。
- `reward_available`：奖励或中奖通知。
- `focus_complete`：专注完成和休息结束本地反馈。

字段统一为 `id/type/userId/title/body/data/dedupeKey/scheduledAt/createdAt`；`dedupeKey` 在用户范围唯一。

## 3. Mobile

- 首次主动开启提醒时请求权限，不在冷启动无上下文弹权限。
- Android 创建 `reminders` 与 `important` channel。
- SQLite 保存本地 notification schedule，系统调度成功后记录 platform ID；取消保持幂等。
- 提供通知设置卡：权限状态、本地测试提醒、是否启用任务提醒。

## 4. API 与重试

- `devices` 保存 platform/deviceName/pushToken/provider/appVersion/lastSeenAt。
- `notification_events` 保存统一事件和状态；`notification_deliveries` 按 device 记录 attempts/nextAttemptAt/error/providerMessageId。
- enqueue 事务创建事件及当前有效设备 deliveries；worker 原子 claim due deliveries。
- 可重试错误指数退避，最多 8 次；无效 token 标记设备 disabled；永久错误标记 failed。
- provider port：FCM HTTP v1 adapter、vendor HTTP adapter、test adapter。

## 5. 验收场景

- Android 权限允许时可安排和取消本地提醒；拒绝时显示明确状态。
- 相同 dedupeKey 不重复创建事件。
- 一个事件按用户所有有效设备扇出；单设备失败不回滚其他设备。
- 临时失败按退避重试，永久 token 错误禁用设备，达到上限后 failed。
- 无 provider 凭证时启动明确失败或使用显式 test provider，不静默成功。
- mobile/API tests、typecheck、build/export 通过。
