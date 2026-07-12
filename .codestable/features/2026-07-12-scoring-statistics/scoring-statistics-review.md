---
doc_type: feature-review
feature: 2026-07-12-scoring-statistics
status: passed
reviewer: self
reviewed: 2026-07-12
round: 1
---

# Scoring Statistics 代码审查

- 审查覆盖会话幂等、并发连续分、公式配置、三小时衰减、可信等级、紧急退出映射、统计分页和客户端权威边界。
- 修复同一天多次完成会重复获得连续分的问题，使用 `streak_award_key` 唯一约束并在冲突后仅取消重复连续分。
- 修复锁机紧急退出同步为普通取消的问题，确保服务端能执行紧急退出扣分。
- 修复环境校验丢弃积分参数的问题，所有公式参数现在进入统一配置入口。
- 原始会话不被积分模块覆盖；积分流水按会话追加，重复 finish 仍可安全补结算。
- 结论：无未解决 blocking 或 important 问题。
