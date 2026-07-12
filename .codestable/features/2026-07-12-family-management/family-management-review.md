---
doc_type: feature-review
feature: 2026-07-12-family-management
status: passed
reviewed: 2026-07-12
---
# Family Management 代码审查
- 修复审批可写入未校验任务字段的问题，统一限制字段、类型和范围。
- 活动会话期间拒绝批准修改或删除，避免产生孤立专注记录。
- 家庭查询同时校验活跃家长和活跃孩子关系，退出后不能继续读取新状态。
- 不提供家长远程直接锁机能力；异常通知按事件和日期去重。
- 结论：无未解决 blocking 或 important 问题。
