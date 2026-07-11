---
doc_type: feature-design
feature: 2026-07-11-forced-trigger-scheduler
roadmap: complete-project
roadmap_item: forced-trigger-scheduler
status: approved
summary: 离线强制触发、十分钟缓冲、两次延迟和最终锁机
tags: [android, alarm, forced-lock, offline]
---

# Forced Trigger Scheduler 设计

- 强制规则使用 Android AlarmManager `setExactAndAllowWhileIdle`，不依赖网络、JS 进程或服务端在线。
- 规则保存于原生 SharedPreferences；BOOT_COMPLETED 后恢复。若设备关机错过触发点，开机后重新提供十分钟缓冲，而不是跳过当天约束。
- 触发前十分钟发送高优先级提醒，提供“立即开始”和“延迟 20 分钟”；最多延迟两次。
- 最终触发由原生层直接创建 LockSession 并启动前台服务。普通后台启动限制下不强拉 Activity，用户从持续通知返回锁机页。
- 习惯规则每天重复；达到当日目标后推进到下一天。今日必须任务为一次性规则，任务开始后取消。
- 必要条件为风险确认、通知权限、通知读取权限和精确闹钟权限；缺失时拒绝注册规则并在 UI 显示引导。
- 今日必须任务新增本地 `forcedTriggerTime`，习惯沿用 `forceEnabled/triggerTime`。
