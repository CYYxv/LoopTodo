---
doc_type: feature-design
feature: 2026-07-12-subscription-entitlements
roadmap: complete-project
roadmap_item: subscription-entitlements
status: approved
summary: VIP 订单、支付 adapter、回调审计和权益控制
tags: [subscription, payment, entitlement, vip]
---

# Subscription Entitlements 设计

- 支持月、季、年订阅，默认价格分别为 9.9、27.9、99 元，基础自律能力保持免费。
- 支付通过 `http` 和明确标记的 `test` adapter 接入，生产环境禁止 test provider。
- 创建订单使用用户级 Idempotency-Key；支付回调使用 HMAC-SHA256 验签并记录最小化哈希审计。
- 同一用户的并发续费使用 PostgreSQL advisory lock 串行化，从当前有效到期时间继续叠加。
- 无效签名不能抢占合法事件 ID，后续有效回调仍可正常激活订单。
- 免费版最多三个活动习惯，服务层提示与数据库事务内并发校验共同保证上限。
- VIP 解锁主题、背景、海报、白噪音、更多习惯、任务型 AI/MCP 和家庭管理。
