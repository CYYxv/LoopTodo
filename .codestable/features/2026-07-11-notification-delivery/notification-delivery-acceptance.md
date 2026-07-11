---
doc_type: feature-acceptance
feature: 2026-07-11-notification-delivery
status: passed
accepted: 2026-07-11
round: 1
---

# Notification Delivery 验收

- Mobile 只在用户点击“开启通知”后请求权限，配置 `reminders` 与 `important` Android channel。
- 本地通知计划和平台 notification ID 保存到 SQLite，可调度、取消并持久化任务提醒开关。
- API 保存设备、通知事件和按设备拆分的交付记录，相同用户的 `dedupeKey` 幂等。
- FCM HTTP v1、vendor HTTP 和 test provider 均通过统一 port；缺少真实凭证不会静默成功。
- worker 自动轮询 due delivery，最多重试八次，无效 token 会禁用设备。
