---
doc_type: feature-design
feature: 2026-07-12-task-ai-service
roadmap: complete-project
roadmap_item: task-ai-service
status: approved
summary: 任务材料限定的 AI 问答、审计和外部数据风险提示
tags: [api, mobile, ai, audit]
---

# Task AI Service 设计

- AI 输入仅包含当前任务标题、用户问题和用户显式批准的当前任务材料。
- 服务端按用户与任务校验材料归属，单次最多 20 份、总内容不超过 100000 字符。
- 专注会话进行中禁止新增 AI 材料，问答只能使用会话开始前已批准的材料。
- provider 通过 adapter 接入；缺少配置时明确失败，生产环境禁止 test provider。
- prompt injection、角色扮演和无关闲聊在调用 provider 前阻断。
- 审计仅保存问题 SHA-256、材料 ID、provider、阻断原因和外部数据标记，不保存原始问题与回答。
- provider 调用失败记录 `provider_error`；使用外部数据的回答必须向用户显示风险提示。
