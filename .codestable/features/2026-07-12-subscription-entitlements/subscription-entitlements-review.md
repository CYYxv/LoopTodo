---
doc_type: feature-review
feature: 2026-07-12-subscription-entitlements
status: passed
reviewer: self
reviewed: 2026-07-12
round: 1
---

# Subscription Entitlements 代码审查

- 审查覆盖订单幂等、provider 配置、生产测试隔离、回调签名、事件重放、并发续费、习惯上限和 AI 权益门控。
- 修复无效签名先占用事件 ID 后阻断合法回调的问题；已验证审计不可被后续无效请求降级。
- 修复多个已支付订单并发激活可能从同一到期时间开始的问题，按用户事务锁顺序叠加。
- 免费习惯上限在 Prisma 事务内再次校验，避免多个设备同时创建突破三个。
- 支付 provider 失败明确将订单标记失败并向上抛出，不伪造支付成功。
- 结论：无未解决 blocking 或 important 问题。
