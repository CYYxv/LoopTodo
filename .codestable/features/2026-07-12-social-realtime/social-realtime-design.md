---
doc_type: feature-design
feature: 2026-07-12-social-realtime
roadmap: complete-project
roadmap_item: social-realtime
status: approved
summary: 好友、每日 PK、无聊天自习室和实时状态
tags: [api, mobile, websocket, social]
---

# Social Realtime 设计

- 好友邀请使用无方向唯一 pair key，防止双方同时邀请产生重复关系；只有已接受好友可以创建每日 PK。
- 每对好友每天最多一个 PK，进度按服务端已结算的完成专注分钟统计。
- 积分结算通过应用事件总线通知社交网关，Socket.IO 向已订阅双方实时推送 PK 进度。
- 自习室支持公开房间和邀请码私密房间，成员关系持久化；私密房不出现在非成员列表中。
- 自习室没有聊天事件或接口，只允许发送固定励志表情，并使用 Redis 做每用户一秒限流。
- WebSocket 握手使用访问令牌，加入房间和订阅 PK 前再次校验成员或参与者身份。
- 用户社交开关及任务可见性字段已进入服务端模型，后续设置模块统一管理。
