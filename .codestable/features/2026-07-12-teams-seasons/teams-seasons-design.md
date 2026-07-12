---
doc_type: feature-design
feature: 2026-07-12-teams-seasons
roadmap: complete-project
roadmap_item: teams-seasons
status: approved
summary: 六个月赛季、固定段位、排行榜和万人战队
tags: [season, rank, leaderboard, team]
---

# Teams Seasons 设计

- 赛季按自然半年自动创建，1 月至 6 月为 S1、7 月至 12 月为 S2，服务端时间为准。
- 赛季结束将积分聚合为不可覆盖的排名快照；新赛季起始段位按上赛季下降三个大段。
- 六个段位使用服务端可配置固定阈值，默认青铜、白银、黄金、铂金、钻石、大师。
- 今日、周、月、赛季榜从权威积分流水聚合，今日榜使用 Redis 短缓存。
- 每个用户只能加入一个战队；创建者为队长，其他用户为成员，战队最多 10000 人。
- 战队人数使用数据库条件递增预留名额，避免并发加入突破上限。
- 战队榜默认使用人均分 70% 加总分平方根奖励 30%，权重可由服务端配置，不使用活跃率。
