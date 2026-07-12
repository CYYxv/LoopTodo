---
doc_type: feature-design
feature: 2026-07-12-reward-backoffice
roadmap_item: reward-backoffice
status: approved
---
# Reward Backoffice 设计
- 管理员由数据库角色或 `ADMIN_EMAILS` 配置识别，所有后台接口同时要求有效访问令牌。
- 支持虚拟和实物奖励、库存、图片 URL、运营配置及定向中奖记录。
- 实物库存授奖时事务扣减，用户放弃后事务归还。
- 收货地址使用 AES-256-GCM 字段级加密；普通后台列表不返回地址。
- 仅已接受实物奖励的专用发货接口可解密地址，并记录访问审计。
- 用户中奖后收到通知，可提前保存地址并选择接受或放弃奖励。
