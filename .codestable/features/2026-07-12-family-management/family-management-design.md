---
doc_type: feature-design
feature: 2026-07-12-family-management
roadmap_item: family-management
status: approved
---
# Family Management 设计
- 家庭成员支持多家长、多孩子和主动退出，退出后停止共享新数据。
- 邀请码单次使用、七天过期、仅存 SHA-256，并使用 Redis 限制暴力尝试。
- 家庭组任一活动成员具有有效 VIP 才能新增邀请、任务或审批管理。
- 家长可下发任务和强制触发时间，但没有实时远程开启锁机接口。
- 孩子不能直接修改或删除家长任务，只能提交白名单字段的修改或删除申请。
- 家长可查看关联孩子的任务、专注和失败明细；紧急退出、权限关闭、重启和逾期可触发异常提醒。
