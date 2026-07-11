---
doc_type: feature-acceptance
feature: 2026-07-11-forced-trigger-scheduler
status: passed
accepted: 2026-07-11
round: 1
---

# Forced Trigger Scheduler 验收

- 今日必须任务和强制习惯均可配置触发时间。
- 本机在触发前十分钟提醒，用户可立即开始或最多延迟两次。
- 无操作或延迟用完后由原生层启动锁机会话。
- 规则支持离线执行、Doze 精确触发和重启恢复。
- 权限缺失时不伪装成功，并提供通知屏蔽与精确闹钟设置入口。
