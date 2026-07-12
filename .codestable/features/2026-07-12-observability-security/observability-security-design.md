---
doc_type: feature-design
feature: 2026-07-12-observability-security
roadmap_item: observability-security
status: approved
---
# Observability Security 设计
- 每个 HTTP 请求生成或校验 `x-request-id`，返回响应头并输出不含请求体、查询参数和认证头的结构化日志。
- 新增追加式 `security_events`，统一记录授权、支付、隐私和 AI 安全事件。
- 目标标识仅保存 SHA-256；元数据递归脱敏密码、令牌、地址、电话、问题、答案和内容字段。
- 家庭越权、支付签名失败、奖励地址读取、AI 越界与 provider 失败接入统一审计。
- 保留现有支付、奖励和 AI 专项审计表，统一安全事件用于跨模块检索，不替代业务审计。

