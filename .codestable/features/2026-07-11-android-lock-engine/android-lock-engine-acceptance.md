---
doc_type: feature-acceptance
feature: 2026-07-11-android-lock-engine
status: passed
accepted: 2026-07-11
round: 1
---

# Android Lock Engine 验收

- 锁机模式已可从 RN 启动 Kotlin 原生会话，最长三小时。
- 锁机前检查通知、通知读取和首次风险确认；可引导开启无障碍及电池优化设置。
- 前台服务、BOOT_COMPLETED 和双层持久化支持进程及重启恢复。
- 锁机页保留闹钟通知，提供紧急电话、应用内拍照和紧急退出申请。
- 每自然月两次紧急退出在原生层执行，原因进入追加式会话记录。
- arm64 Debug APK 原生编译通过。
