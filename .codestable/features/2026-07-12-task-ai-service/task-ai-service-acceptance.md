---
doc_type: feature-acceptance
feature: 2026-07-12-task-ai-service
status: passed
accepted: 2026-07-12
round: 1
---

# Task AI Service 验收

- 用户可在专注开始前为当前任务添加 AI 材料，专注中不能新增材料。
- 问答仅使用当前任务已批准材料，并拒绝明显的提示注入、角色扮演和无关闲聊。
- 未配置真实 provider 时返回明确错误，不伪造成功结果。
- 使用外部数据的回答显示风险提示，provider 失败与阻断均保留最小化审计记录。
- 移动端未登录时明确显示不可用状态，配置访问令牌后可加载材料并提问。
