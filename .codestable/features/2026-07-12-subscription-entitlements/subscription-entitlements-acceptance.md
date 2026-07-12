---
doc_type: feature-acceptance
feature: 2026-07-12-subscription-entitlements
status: passed
accepted: 2026-07-12
round: 1
---

# Subscription Entitlements 验收

- 用户可查询当前 VIP、到期时间和各项权益，并创建月、季、年订阅订单。
- 开发环境可使用明确标识且不产生真实扣款的测试支付；生产环境拒绝测试 provider。
- 支付成功后订阅按已有到期时间续期，重复回调不会重复增加时长。
- 免费用户最多创建三个习惯，任务型 AI 和家庭管理需要 VIP。
- VIP 到期保留历史数据，但权益查询后停止新增受限能力。
