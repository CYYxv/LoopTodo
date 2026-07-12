---
doc_type: feature-review
feature: 2026-07-12-task-ai-service
status: passed
reviewer: self
reviewed: 2026-07-12
round: 1
---

# Task AI Service 代码审查

- 审查覆盖任务与材料归属、专注中只读约束、输入范围、provider 配置、失败审计、隐私边界和移动端材料 ID 选择。
- API 查询材料时同时限定 `userId`、`taskId` 和材料 ID，不能引用其他任务或其他用户的材料。
- 移动端问答只提交当前任务 store 中已加载的材料 ID，不接受用户直接构造材料 ID。
- 原始问题和回答不进入审计表；provider 异常会记录 `provider_error` 后继续向上抛出，不做静默 fallback。
- test provider 在 production 明确拒绝；HTTP provider 缺 endpoint 或 key 明确失败。
- 结论：无未解决 blocking 或 important 问题。
