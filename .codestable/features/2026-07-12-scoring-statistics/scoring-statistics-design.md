---
doc_type: feature-design
feature: 2026-07-12-scoring-statistics
roadmap: complete-project
roadmap_item: scoring-statistics
status: approved
summary: 服务端权威的追加式积分流水与移动端统计
tags: [api, mobile, scoring, statistics]
---

# Scoring Statistics 设计

- 每个已结束专注会话生成一条不可覆盖的 `score_events` 流水，`session_id` 唯一保证重复同步不会重复计分。
- 时长、连续、可信和惩罚分分列保存，并记录公式版本，便于后续重算与审计。
- 默认时长分权重为 0.6；超过 3 小时的部分按 25% 有效时长计算；不计时模式使用固定少量分。
- 连续分每天只发放一次，数据库唯一键保证同日并发结算不会重复发分；中断后不能补救。
- 高可信和普通可信分别获得可配置可信分，开放或无效专注不获得竞技可信分。
- 锁机紧急退出同步为 `emergency_exit` 并应用可配置负分，普通专注退出保持 `cancelled`。
- 所有公式参数由服务端环境配置，客户端只显示服务端最终积分；离线时仅显示本地时长与次数统计。
