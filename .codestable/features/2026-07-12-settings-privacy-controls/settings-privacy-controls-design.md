---
doc_type: feature-design
feature: 2026-07-12-settings-privacy-controls
roadmap_item: settings-privacy-controls
status: approved
---
# Settings Privacy Controls 设计
- 设置显式保存多设备同步、社交开关、任务可见性、联网策略和三类通知偏好。
- 默认采用离线执行后同步；用户可要求联网，但已开始的锁机始终本地安全执行。
- 关闭社交后好友、PK、自习室、WebSocket 和排行榜展示均停止访问，历史关系保留。
- 当前任务和今日完成任务默认不可见，仅好友或同一自习室成员可按用户开关查询。
- 通知偏好在服务端统一投递入口执行，禁用后不创建发送任务。
- 锁机前权限仍实时检查，设置页面仅用于状态展示和系统设置入口。
