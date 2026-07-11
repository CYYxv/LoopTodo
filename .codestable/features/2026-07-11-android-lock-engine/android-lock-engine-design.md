---
doc_type: feature-design
feature: 2026-07-11-android-lock-engine
roadmap: complete-project
roadmap_item: android-lock-engine
status: approved
summary: Kotlin 锁机桥接、权限检测、前台服务、重启恢复和紧急退出
tags: [android, kotlin, expo-module, lock]
---

# Android Lock Engine 设计

- 使用本地 Expo Module `AndroidLockEngine`，RN 不直接控制 Android service/activity。
- 原生 SharedPreferences 是锁机运行状态权威，SQLite 保存业务会话；启动失败时补偿解除原生状态，进程恢复时由原生状态回填 SQLite。
- 启动前检查通知权限、通知读取权限和首次风险确认；无障碍为增强约束，电池优化白名单为推荐项。
- 单次结束时间强制限制在三小时内；每自然月最多两次紧急退出并要求原因。
- 前台服务保持会话并在结束时清理；BOOT_COMPLETED 在重启后恢复服务。
- 全屏 Activity 提供任务、剩余时间、紧急电话、拍照和紧急退出申请入口。
- NotificationListenerService 在锁机期间取消普通通知，保留系统时钟/闹钟通知。
- AccessibilityService 仅在用户启用增强约束时检测离开应用并返回锁机页。
- Device Owner 已允许 Lock Task 时使用系统 Lock Task；普通设备不伪装为不可绕过 kiosk。
