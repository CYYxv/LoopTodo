---
doc_type: feature-qa
feature: 2026-07-11-notification-delivery
status: passed
tested: 2026-07-11
round: 1
---

# Notification Delivery QA

## Mobile

- 通知 store 针对性测试：2 tests passed。
- `npm run typecheck`：passed。
- Android Expo export：passed，Hermes bundle 已生成。

## API

- 通知服务针对性测试：3 tests passed。
- `npm run typecheck`：passed。
- `npm run build`：passed。
- `npm run prisma:validate`：passed。

覆盖权限拒绝、权限允许、调度、取消、事件防重、设备扇出、单设备失败隔离、指数退避、八次上限和无效 token 禁用。
