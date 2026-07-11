---
doc_type: feature-review
feature: 2026-07-11-android-lock-engine
status: passed
reviewer: self
reviewed: 2026-07-11
round: 1
---

# Android Lock Engine 代码审查

- 审查覆盖 Expo Module、原生状态、前台服务、Activity、通知监听、无障碍、重启恢复、CameraX 和 RN 状态协调。
- 已修复直接结束 RN Activity、Android 7 通知 Builder 不兼容、系统相机可能进入相册、通知监听权限未作为必要条件等问题。
- 原生启动后 SQLite 写入失败会补偿解除锁机；进程恢复时原生状态优先回填 SQLite。
- 紧急退出原因必填并在原生层按自然月限制两次；清除应用数据仍可重置本地额度，后续服务端锁机会话将作为跨设备权威。
- 普通设备使用可披露的强约束方案，只有 Device Owner 允许时才启用系统 Lock Task。
- 结论：无未解决 blocking 或 important 问题。
