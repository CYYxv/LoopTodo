---
doc_type: feature-review
feature: 2026-07-12-observability-security
status: passed
---
# Observability Security 代码审查
- 请求日志只记录方法、路径、状态、耗时、请求 ID 和用户 ID，不记录 body、query、cookie、authorization。
- 安全事件为追加式写入，目标 ID 哈希化，元数据经过统一递归脱敏。
- 支付伪造回调仍先写专项哈希审计，再写统一拒绝事件，不记录签名或原始 payload。
- AI 事件仅包含 question hash、阻断原因、provider 和材料数量，不记录问题、答案或材料正文。
- 奖励地址读取仅记录地址/claim 的哈希目标，不写电话、收件人、地址明文。
- 同时修复模块依赖遗漏：计分模块显式导入认证与事件总线，家庭模块显式导入 Redis。
- 结论：无未解决的 blocking 或 important 问题。

