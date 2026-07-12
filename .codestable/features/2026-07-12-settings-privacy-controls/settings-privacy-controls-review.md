---
doc_type: feature-review
feature: 2026-07-12-settings-privacy-controls
status: passed
---
# Settings Privacy Controls 代码审查
- 审查覆盖社交关闭、任务默认不可见、通知抑制、多设备锁和权限实时检查。
- 修复任务可见性设置只保存但未实际约束查询的问题。
- 社交状态查询必须是已接受好友或同一活动自习室成员，失败原因始终不向普通社交开放。
- 联网策略不覆盖锁机本地执行不变量。
- 结论：无未解决 blocking 或 important 问题。
