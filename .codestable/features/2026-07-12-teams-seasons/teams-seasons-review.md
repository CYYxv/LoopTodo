---
doc_type: feature-review
feature: 2026-07-12-teams-seasons
status: passed
reviewer: self
reviewed: 2026-07-12
round: 1
---

# Teams Seasons 代码审查

- 审查覆盖赛季边界、历史积分归属、段位降级、榜单周期校验、战队唯一成员关系、并发人数上限和万人查询规模。
- 修复旧积分未关联当前赛季导致战队榜缺分的问题，读取当前赛季时统一补齐归属。
- 修复异步积分事件失败可能产生未处理 Promise 的问题，统一记录服务日志。
- 战队榜从加载所有成员对象改为 PostgreSQL 聚合，只返回每队汇总行，避免万人战队造成对象爆炸。
- 段位阈值 JSON 在环境入口严格验证，不使用静默配置 fallback。
- 结论：无未解决 blocking 或 important 问题。
